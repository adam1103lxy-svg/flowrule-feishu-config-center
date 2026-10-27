import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { connector, messageEvent, rule, taskRun } from '@server/database/schema';
import type {
  DiscoveredChat,
  MessageType,
  RuleConfig,
  Rule,
  SimulationInput,
  SimulationResult,
  SenderRole,
} from '@shared/api.interface';
import { normalizeRuleConfig, simulateRule } from './engine';
import { AuditService } from './audit.service';
import { TaskRunService } from './task-run.service';

interface IncomingMessageEvent {
  sender?: { sender_id?: { open_id?: string } };
  message?: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    chat_id: string;
    chat_type?: string;
    message_type: string;
    content: string;
    mentions?: { id?: { open_id?: string }; name?: string }[];
  };
}

interface MentionPair {
  openId: string;
  name: string;
}

const SYSTEM_USER = 'flowrule-runtime';

const extractTextFromContent = (
  messageType: string,
  content: string,
): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return '';
  }
  if (parsed === null || typeof parsed !== 'object') return '';
  const obj = parsed as Record<string, unknown>;
  if (messageType === 'text' && typeof obj.text === 'string') {
    return obj.text.replace(/@_user_\d+/g, '').trim();
  }
  if (messageType === 'post') {
    const lines: string[] = [];
    if (typeof obj.title === 'string' && obj.title !== '') lines.push(obj.title);
    const collect = (blocks: unknown): void => {
      if (!Array.isArray(blocks)) return;
      for (const block of blocks) {
        if (block === null || typeof block !== 'object') continue;
        const b = block as Record<string, unknown>;
        if (typeof b.text === 'string') lines.push(b.text);
        if (Array.isArray(b.content)) collect(b.content);
      }
    };
    collect(obj.content);
    return lines.join(' ').replace(/@_user_\d+/g, '').trim();
  }
  return '';
};

const looksLikeOpenId = (value: string): boolean => value.startsWith('ou_');

@Injectable()
export class DispatcherService {
  private readonly logger = new Logger(DispatcherService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
    private readonly taskRunService: TaskRunService,
  ) {}

  async handleIncoming(
    connectionId: string,
    data: IncomingMessageEvent,
  ): Promise<void> {
    const message = data.message;
    if (!message?.message_id || !message.chat_id) return;
    const text = extractTextFromContent(message.message_type, message.content);
    const mentionPairs: MentionPair[] = (message.mentions ?? [])
      .map((m) => ({ openId: m.id?.open_id ?? '', name: m.name ?? '' }))
      .filter((p) => p.openId !== '');
    const replyDepth = message.parent_id ? 2 : message.root_id ? 1 : 0;
    const sentAt = new Date(Number(message.create_time) || Date.now());
    const [inserted] = await this.db
      .insert(messageEvent)
      .values({
        connectionId,
        messageId: message.message_id,
        chatId: message.chat_id,
        chatName: '',
        senderOpenId: data.sender?.sender_id?.open_id ?? '',
        messageType: message.message_type,
        contentText: text,
        mentions: JSON.stringify(mentionPairs),
        rootId: message.root_id ?? '',
        replyDepth,
        sentAt,
        processed: false,
      })
      .onConflictDoNothing({
        target: [messageEvent.connectionId, messageEvent.messageId],
      })
      .returning();
    if (!inserted) return;
    const [conn] = await this.db
      .select()
      .from(connector)
      .where(eq(connector.id, connectionId));
    await this.processStoredEvent(inserted, conn ?? null);
  }

  async processUnprocessed(limit = 50): Promise<number> {
    const cutoff = new Date(Date.now() - 60_000);
    const rows = await this.db
      .select()
      .from(messageEvent)
      .where(and(eq(messageEvent.processed, false), lt(messageEvent.sentAt, cutoff)))
      .limit(limit);
    if (rows.length === 0) return 0;
    const connections = await this.db.select().from(connector);
    const connMap = new Map(
      connections.map((c: typeof connector.$inferSelect) => [c.id, c] as const),
    );
    let processed = 0;
    for (const row of rows) {
      await this.processStoredEvent(row, connMap.get(row.connectionId) ?? null);
      processed += 1;
    }
    return processed;
  }

  private async processStoredEvent(
    event: typeof messageEvent.$inferSelect,
    conn: typeof connector.$inferSelect | null,
  ): Promise<void> {
    try {
      const connectionId = event.connectionId;
      const timezone = conn?.timezone ?? 'Asia/Shanghai';
      const chatId = event.chatId;
      const chatName = this.resolveChatName(conn, chatId);
      let mentionPairs: MentionPair[] = [];
      try {
        mentionPairs = JSON.parse(event.mentions) as MentionPair[];
      } catch {
        mentionPairs = [];
      }
      const mentions = mentionPairs.map((p) => p.openId);
      const input: SimulationInput = {
        messageText: event.contentText,
        sender: event.senderOpenId,
        senderRole: 'member' as SenderRole,
        mentions,
        sentAt: event.sentAt.toISOString(),
        replyDepth: event.replyDepth,
        sourceGroup: chatId,
        messageId: event.messageId,
        messageType: event.messageType as MessageType,
      };
      const rules = await this.db
        .select()
        .from(rule)
        .where(eq(rule.status, 'published'));
      const boundRules = rules.filter((r: typeof rule.$inferSelect) =>
        this.ruleBoundToChat(JSON.parse(r.config) as RuleConfig, connectionId, chatId),
      );
      const mentionNameMap: Record<string, string> = {};
      for (const pair of mentionPairs) mentionNameMap[pair.openId] = pair.name;
      for (const ruleRow of boundRules) {
        const config = normalizeRuleConfig(JSON.parse(ruleRow.config));
        const result = simulateRule(this.toSimRule(ruleRow), input, timezone);
        if (result.cancelMatched) {
          await this.taskRunService.cancelMatching(
            ruleRow.id,
            result.extractedObjectKey,
            config.cancelScope,
            SYSTEM_USER,
          );
          continue;
        }
        if (!result.matched || result.excluded) continue;
        await this.scheduleRun({
          ruleRow,
          config,
          connectionId,
          result,
          chatId,
          chatName,
          messageId: event.messageId,
          messageEventId: event.id,
          mentionNameMap,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `处理消息事件 ${event.messageId} 失败: ${message}（事件已持久化，等待补漏重试）`,
      );
      return;
    } finally {
      await this.db
        .update(messageEvent)
        .set({ processed: true, updatedAt: new Date() })
        .where(eq(messageEvent.id, event.id));
    }
  }

  private toSimRule(row: typeof rule.$inferSelect): Rule {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      type: row.type as Rule['type'],
      status: 'published',
      currentVersion: row.currentVersion,
      config: normalizeRuleConfig(JSON.parse(row.config)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private ruleBoundToChat(
    rawConfig: RuleConfig,
    connectionId: string,
    chatId: string,
  ): boolean {
    const config = normalizeRuleConfig(rawConfig);
    if (config.sourceConnectorId !== connectionId) return false;
    if (config.sourceChatId !== '') return config.sourceChatId === chatId;
    if (config.sourceGroups.length === 0) return true;
    return config.sourceGroups.includes(chatId);
  }

  private resolveChatName(
    conn: typeof connector.$inferSelect | null,
    chatId: string,
  ): string {
    if (!conn) return chatId;
    try {
      const chats = JSON.parse(conn.discoveredChats) as DiscoveredChat[];
      const hit = chats.find((c) => c.chatId === chatId);
      if (hit) return hit.name;
    } catch {
      return chatId;
    }
    return chatId;
  }

  private async scheduleRun(args: {
    ruleRow: typeof rule.$inferSelect;
    config: RuleConfig;
    connectionId: string;
    result: SimulationResult;
    chatId: string;
    chatName: string;
    messageId: string;
    messageEventId: string;
    mentionNameMap: Record<string, string>;
  }): Promise<boolean> {
    const { ruleRow, config, result, mentionNameMap } = args;
    const assigneeOpenIdRaw = result.assignees[0] ?? '';
    const assigneeMode = config.assignee?.mode ?? '';
    const usableModes = ['mention', 'sender', 'mention_first_else_sender'];
    const hasUsableAssignee =
      usableModes.includes(assigneeMode) && assigneeOpenIdRaw !== '';
    const assigneeOpenId = hasUsableAssignee ? assigneeOpenIdRaw : '';
    const assigneeName = mentionNameMap[assigneeOpenId] ?? '';
    const dueAt = result.dueAt !== '' ? new Date(result.dueAt) : null;
    const sourceReadOnlyViolation =
      config.notifyChatId !== '' && config.notifyChatId === args.chatId;
    const [inserted] = await this.db
      .insert(taskRun)
      .values({
        ruleId: ruleRow.id,
        ruleCode: ruleRow.code,
        ruleName: ruleRow.name,
        connectionId: args.connectionId,
        messageEventId: args.messageEventId,
        messageId: args.messageId,
        status:
          sourceReadOnlyViolation || !hasUsableAssignee ? 'needs_review' : 'pending',
        dedupKey: result.dedupKey,
        clientToken: randomUUID(),
        assigneeOpenId,
        assigneeName,
        objectKey: result.extractedObjectKey,
        objectVersion: result.extractedObjectVersion,
        releaseRatio: result.extractedReleaseRatio,
        taskTitle: result.taskTitle,
        taskDesc: result.taskDesc,
        notifyChatId: config.notifyChatId,
        notifyChatName: config.notifyChatName,
        sourceChatId: args.chatId,
        sourceChatName: args.chatName,
        runAt: new Date(result.runAt),
        dueAt,
        taskGuid: '',
        notifyMessageId: '',
        notifyAttempts: 0,
        retryCount: 0,
        nextRetryAt: null,
        lastError: sourceReadOnlyViolation
          ? '通知群与来源群相同，来源群只读，平台严禁向来源群发送任何消息，请把结果通知群改为其他群'
          : hasUsableAssignee
            ? ''
            : '未能解析出可用的飞书负责人 open_id：当前负责人策略基于静态名单/映射表，真实执行请改用「被@人 / 发送者 / @一人优先否则发送者」策略',
        leaseOwner: '',
        leaseExpiresAt: null,
        isDemo: false,
      })
      .onConflictDoNothing({ target: taskRun.dedupKey })
      .returning();
    if (!inserted) return false;
    await this.auditService.write({
      action: 'task_scheduled',
      entityType: 'task_run',
      entityId: inserted.id,
      entityName: result.taskTitle,
      summary: `消息命中规则「${ruleRow.name}」，调度待办任务「${result.taskTitle}」，run_at ${result.runAt}${dueAt ? `，due_at ${result.dueAt}` : '，无截止时间'}`,
      userId: SYSTEM_USER,
    });
    return true;
  }
}

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { connector, taskRun } from '@server/database/schema';
import type {
  TaskRun,
  TaskRunListQuery,
  TaskRunStats,
  TaskRunStatus,
} from '@shared/api.interface';
import { AuditService } from './audit.service';
import { FeishuClientService } from './feishu-client.service';
import { encryptSecret } from './secret-box';

const MAX_AUTO_RETRY = 3;
const MAX_NOTIFY_ATTEMPTS = 5;
const LEASE_MINUTES = 10;
const RETRY_BASE_DELAY_MINUTES = 5;

const ACTIVE_EXECUTING_STATUSES: TaskRunStatus[] = ['pending', 'notify_pending', 'failed'];
type ExecutionContext =
  | { identity: 'app'; client: import('@larksuiteoapi/node-sdk').Client }
  | { identity: 'user'; accessToken: string };

const toTaskRun = (
  row: typeof taskRun.$inferSelect,
  connectionName: string,
): TaskRun => ({
  id: row.id,
  ruleId: row.ruleId,
  ruleCode: row.ruleCode,
  ruleName: row.ruleName,
  connectionId: row.connectionId,
  connectionName,
  messageId: row.messageId,
  status: row.status as TaskRunStatus,
  assigneeOpenId: row.assigneeOpenId,
  assigneeName: row.assigneeName,
  objectKey: row.objectKey,
  objectVersion: row.objectVersion,
  releaseRatio: row.releaseRatio,
  taskTitle: row.taskTitle,
  taskDesc: row.taskDesc,
  sourceChatId: row.sourceChatId,
  sourceChatName: row.sourceChatName,
  notifyChatId: row.notifyChatId,
  notifyChatName: row.notifyChatName,
  runAt: row.runAt.toISOString(),
  dueAt: row.dueAt ? row.dueAt.toISOString() : null,
  taskGuid: row.taskGuid,
  taskUrl: row.taskUrl,
  notifyMessageId: row.notifyMessageId,
  executionIdentity: row.executionIdentity as TaskRun['executionIdentity'],
  retryCount: row.retryCount,
  notifyAttempts: row.notifyAttempts,
  nextRetryAt: row.nextRetryAt ? row.nextRetryAt.toISOString() : null,
  lastError: row.lastError,
  dedupKey: row.dedupKey,
  isDemo: row.isDemo,
  createdAt: row.createdAt.toISOString(),
});

const toMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (response?.data !== undefined) {
      try {
        return JSON.stringify(response.data);
      } catch {
        // Fall through to the ordinary error message.
      }
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
};

@Injectable()
export class TaskRunService {
  private readonly logger = new Logger(TaskRunService.name);
  private readonly leaseOwner = `worker-${process.pid}`;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
    private readonly feishuClientService: FeishuClientService,
  ) {}

  async list(
    query: TaskRunListQuery,
  ): Promise<{ items: TaskRun[]; stats: TaskRunStats }> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(taskRun.status, query.status));
    if (query.ruleCode) conditions.push(eq(taskRun.ruleCode, query.ruleCode));
    if (query.keyword) {
      const parts = or(
        eq(taskRun.messageId, query.keyword),
        eq(taskRun.taskGuid, query.keyword),
        eq(taskRun.objectKey, query.keyword),
        eq(taskRun.ruleCode, query.keyword),
      );
      if (parts) conditions.push(parts);
    }
    const rows = await this.db
      .select({ run: taskRun, connectionName: connector.name })
      .from(taskRun)
      .leftJoin(connector, eq(taskRun.connectionId, connector.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(taskRun.runAt))
      .limit(200);
    const stats = await this.stats();
    return {
      items: rows.map((r) => toTaskRun(r.run, r.connectionName ?? '')),
      stats,
    };
  }

  async stats(): Promise<TaskRunStats> {
    const rows = await this.db
      .select({ status: taskRun.status, total: count() })
      .from(taskRun)
      .groupBy(taskRun.status);
    const stats: TaskRunStats = {
      pending: 0,
      created: 0,
      notify_pending: 0,
      failed: 0,
      needs_review: 0,
      cancelled: 0,
    };
    for (const row of rows) {
      const total = Number(row.total);
      if (row.status === 'pending') stats.pending = total;
      else if (row.status === 'created') stats.created = total;
      else if (row.status === 'notify_pending') stats.notify_pending = total;
      else if (row.status === 'failed') stats.failed = total;
      else if (row.status === 'needs_review') stats.needs_review = total;
      else if (row.status === 'cancelled') stats.cancelled = total;
    }
    return stats;
  }

  async retry(id: string, userId: string): Promise<TaskRun> {
    const [row] = await this.db.select().from(taskRun).where(eq(taskRun.id, id));
    if (!row) throw new NotFoundException('运行记录不存在');
    if (!['failed', 'needs_review', 'notify_pending'].includes(row.status)) {
      throw new BadRequestException('当前状态不支持重试（仅失败 / 待确认 / 待通知可重试）');
    }
    const nextStatus = row.taskGuid !== '' ? 'notify_pending' : 'pending';
    const [updated] = await this.db
      .update(taskRun)
      .set({
        status: nextStatus,
        nextRetryAt: new Date(),
        leaseOwner: '',
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(taskRun.id, id))
      .returning();
    await this.auditService.write({
      action: 'task_retried',
      entityType: 'task_run',
      entityId: row.id,
      entityName: row.taskTitle,
      summary: `人工重试运行任务「${row.taskTitle}」（${row.ruleName}），恢复为${nextStatus === 'pending' ? '待执行' : '待通知'}`,
      userId,
    });
    void this.processDue(5).catch((error: unknown) => {
      this.logger.error(`人工重试后立即执行失败: ${toMessage(error)}`);
    });
    return toTaskRun(updated, '');
  }

  async cancel(id: string, userId: string): Promise<TaskRun> {
    const [row] = await this.db.select().from(taskRun).where(eq(taskRun.id, id));
    if (!row) throw new NotFoundException('运行记录不存在');
    if (!ACTIVE_EXECUTING_STATUSES.includes(row.status as TaskRunStatus)) {
      throw new BadRequestException('当前状态不支持取消');
    }
    const [updated] = await this.db
      .update(taskRun)
      .set({ status: 'cancelled', leaseExpiresAt: null, updatedAt: new Date() })
      .where(eq(taskRun.id, id))
      .returning();
    await this.auditService.write({
      action: 'task_cancelled',
      entityType: 'task_run',
      entityId: row.id,
      entityName: row.taskTitle,
      summary: `人工取消运行任务「${row.taskTitle}」（${row.ruleName}）${row.taskGuid !== '' ? '（飞书待办已创建，请手动处理）' : ''}`,
      userId,
    });
    return toTaskRun(updated, '');
  }

  async processDue(limit = 20): Promise<number> {
    const now = new Date();
    const conditions: SQL[] = [
      or(
        and(eq(taskRun.status, 'pending'), lte(taskRun.runAt, now)),
        eq(taskRun.status, 'notify_pending'),
        and(eq(taskRun.status, 'failed'), lte(taskRun.nextRetryAt, now)),
      ) as SQL,
    ];
    const candidates = await this.db
      .select()
      .from(taskRun)
      .where(and(...conditions))
      .orderBy(asc(taskRun.runAt))
      .limit(limit);
    let processed = 0;
    for (const row of candidates) {
      const leased = await this.acquireLease(row.id);
      if (!leased) continue;
      try {
        await this.executeOne(leased);
        processed += 1;
      } catch (error) {
        this.logger.error(
          `执行运行任务 ${row.id} 出现未预期异常: ${toMessage(error)}`,
        );
      } finally {
        await this.releaseLease(row.id);
      }
    }
    return processed;
  }

  private async acquireLease(
    id: string,
  ): Promise<typeof taskRun.$inferSelect | null> {
    const expires = new Date(Date.now() + LEASE_MINUTES * 60_000);
    const [row] = await this.db
      .update(taskRun)
      .set({ leaseOwner: this.leaseOwner, leaseExpiresAt: expires })
      .where(
        and(
          eq(taskRun.id, id),
          or(isNull(taskRun.leaseExpiresAt), lte(taskRun.leaseExpiresAt, new Date())),
        ),
      )
      .returning();
    return row ?? null;
  }

  private async releaseLease(id: string): Promise<void> {
    await this.db
      .update(taskRun)
      .set({ leaseExpiresAt: null })
      .where(and(eq(taskRun.id, id), eq(taskRun.leaseOwner, this.leaseOwner)));
  }

  private async executeOne(row: typeof taskRun.$inferSelect): Promise<void> {
    const [conn] = await this.db
      .select()
      .from(connector)
      .where(eq(connector.id, row.connectionId));
    const credential = conn
      ? this.feishuClientService.resolveCredential(conn.feishuAppId, conn.appSecretEnc)
      : null;
    if (!credential) {
      await this.db
        .update(taskRun)
        .set({
          status: 'needs_review',
          lastError: '连接缺少真实的 App ID / App Secret，无法执行；请到连接中心完成配置与授权后重试',
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(taskRun.id, row.id));
      return;
    }
    let context: ExecutionContext;
    try {
      context = await this.resolveExecutionContext(conn!, credential);
    } catch (error) {
      await this.markFailure(row, `执行身份不可用: ${toMessage(error)}`);
      return;
    }
    await this.db
      .update(taskRun)
      .set({ executionIdentity: context.identity, updatedAt: new Date() })
      .where(eq(taskRun.id, row.id));
    const executingRow = { ...row, executionIdentity: context.identity };

    if (row.status === 'notify_pending') {
      await this.verifyAndNotify(executingRow, context);
      return;
    }

    if (row.status === 'failed' && row.taskGuid !== '') {
      await this.verifyAndNotify(executingRow, context);
      return;
    }

    await this.runCreate(executingRow, context);
  }

  private async resolveExecutionContext(
    conn: typeof connector.$inferSelect,
    credential: { appId: string; appSecret: string },
  ): Promise<ExecutionContext> {
    if (conn.executionIdentity === 'user') {
      try {
        let accessToken = this.feishuClientService.resolveEncryptedValue(
          conn.userAccessTokenEnc,
        );
        if (!accessToken) throw new Error('尚未完成用户 OAuth 授权');
        if (!conn.userTokenExpiresAt || conn.userTokenExpiresAt.getTime() <= Date.now()) {
          const refreshToken = this.feishuClientService.resolveEncryptedValue(
            conn.userRefreshTokenEnc,
          );
          if (!refreshToken) throw new Error('用户令牌已过期且无刷新令牌');
          const refreshed = await this.feishuClientService.refreshUserToken(
            credential,
            refreshToken,
          );
          accessToken = refreshed.accessToken;
          await this.db
            .update(connector)
            .set({
              userAccessTokenEnc: encryptSecret(refreshed.accessToken),
              userRefreshTokenEnc: encryptSecret(refreshed.refreshToken),
              userTokenExpiresAt: new Date(
                Date.now() + Math.max(60, refreshed.expiresIn - 60) * 1000,
              ),
              userRefreshExpiresAt: refreshed.refreshExpiresIn
                ? new Date(Date.now() + refreshed.refreshExpiresIn * 1000)
                : conn.userRefreshExpiresAt,
              userOpenId: refreshed.openId || conn.userOpenId,
              userName: refreshed.name || conn.userName,
              updatedAt: new Date(),
            })
            .where(eq(connector.id, conn.id));
        }
        return { identity: 'user', accessToken };
      } catch (error) {
        if (!conn.allowIdentityFallback) throw error;
        this.logger.warn(`用户身份不可用，按连接器配置回退应用身份: ${toMessage(error)}`);
      }
    }
    return {
      identity: 'app',
      client: this.feishuClientService.getClient(conn.id, credential),
    };
  }

  private async runCreate(
    row: typeof taskRun.$inferSelect,
    context: ExecutionContext,
  ): Promise<void> {
    try {
      const options = {
        summary: row.taskTitle,
        description: row.taskDesc,
        assigneeOpenId: row.assigneeOpenId,
        dueAt: row.dueAt,
        clientToken: row.clientToken,
      };
      const created = context.identity === 'user'
        ? await this.feishuClientService.createTaskAsUser(context.accessToken, options)
        : await this.feishuClientService.createTask(context.client, options);
      // 创建成功后先持久化 task_guid，再进行回读核验与通知
      const [saved] = await this.db
        .update(taskRun)
        .set({
          status: 'created',
          taskGuid: created.guid,
          taskUrl: created.url,
          lastError: '',
          retryCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(taskRun.id, row.id))
        .returning();
      await this.auditService.write({
        action: 'task_created',
        entityType: 'task_run',
        entityId: row.id,
        entityName: row.taskTitle,
        summary: `飞书待办创建成功：「${row.taskTitle}」（负责人 ${row.assigneeName || row.assigneeOpenId}，guid ${created.guid}）`,
      });
      await this.verifyAndNotify(saved, context);
    } catch (error) {
      await this.markFailure(row, `创建飞书待办失败: ${toMessage(error)}`);
    }
  }

  private async verifyAndNotify(
    row: typeof taskRun.$inferSelect,
    context: ExecutionContext,
  ): Promise<void> {
    try {
      const verified = context.identity === 'user'
        ? await this.feishuClientService.getTaskAsUser(context.accessToken, row.taskGuid)
        : await this.feishuClientService.getTask(context.client, row.taskGuid);
      if (verified.guid !== row.taskGuid) {
        throw new Error(`回读 guid 不一致：期望 ${row.taskGuid}，实际 ${verified.guid}`);
      }
      if (row.assigneeOpenId !== '' && !verified.assigneeOpenIds.includes(row.assigneeOpenId)) {
        throw new Error(
          `回读负责人不一致：期望 ${row.assigneeOpenId}，实际 [${verified.assigneeOpenIds.join(', ')}]`,
        );
      }
      const [verifiedRow] = await this.db
        .update(taskRun)
        .set({ taskUrl: verified.url, updatedAt: new Date() })
        .where(eq(taskRun.id, row.id))
        .returning();
      await this.runNotify(verifiedRow, context);
    } catch (error) {
      const message = `Task v2 回读核验失败: ${toMessage(error)}`;
      await this.db
        .update(taskRun)
        .set({ status: 'needs_review', lastError: message, updatedAt: new Date() })
        .where(eq(taskRun.id, row.id));
      await this.auditService.write({
        action: 'task_failed',
        entityType: 'task_run',
        entityId: row.id,
        entityName: row.taskTitle,
        summary: `「${row.taskTitle}」回读核验失败，进入待确认：${message}`,
      });
    }
  }

  private async runNotify(
    row: typeof taskRun.$inferSelect,
    context: ExecutionContext,
  ): Promise<void> {
    if (row.notifyChatId === '') return;
    if (row.notifyChatId === row.sourceChatId) {
      await this.db
        .update(taskRun)
        .set({
          status: 'needs_review',
          lastError: '通知群与来源群相同，来源群只读，已拦截本次发送',
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(taskRun.id, row.id));
      await this.auditService.write({
        action: 'task_failed',
        entityType: 'task_run',
        entityId: row.id,
        entityName: row.taskTitle,
        summary: `已拦截向来源群「${row.sourceChatName || row.sourceChatId}」发送结果通知：来源群只读`,
      });
      return;
    }
    const assignee = row.assigneeOpenId
      ? `<at user_id="${row.assigneeOpenId}">${row.assigneeName || '负责人'}</at>`
      : '未识别';
    const text = [
      '【FlowRule】飞书待办已创建',
      `规则：${row.ruleName}`,
      `待办：${row.taskTitle}`,
      `负责人：${assignee}`,
      row.dueAt ? `截止：${row.dueAt.toISOString()}` : '截止：未设置',
      row.taskGuid !== '' ? `待办 GUID：${row.taskGuid}` : '',
      row.taskUrl !== '' ? `打开待办：${row.taskUrl}` : '打开待办：请到飞书任务中心按 GUID 查询',
      `来源消息：${row.sourceChatName || row.sourceChatId} · ${row.messageId}`,
    ]
      .filter((line: string) => line !== '')
      .join('\n');
    try {
      const messageId = context.identity === 'user'
        ? await this.feishuClientService.sendTextMessageAsUser(
            context.accessToken,
            row.notifyChatId,
            text,
          )
        : await this.feishuClientService.sendTextMessage(
            context.client,
            row.notifyChatId,
            text,
          );
      await this.db
        .update(taskRun)
        .set({
          status: 'created',
          notifyMessageId: messageId,
          notifyAttempts: row.notifyAttempts + 1,
          lastError: '',
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(taskRun.id, row.id));
      await this.auditService.write({
        action: 'task_notified',
        entityType: 'task_run',
        entityId: row.id,
        entityName: row.taskTitle,
        summary: `创建结果已通知到「${row.notifyChatName || row.notifyChatId}」（message_id ${messageId}）`,
      });
    } catch (error) {
      const attempts = row.notifyAttempts + 1;
      const message = `结果通知发送失败: ${toMessage(error)}`;
      const giveUp = attempts >= MAX_NOTIFY_ATTEMPTS;
      await this.db
        .update(taskRun)
        .set({
          status: giveUp ? 'needs_review' : 'notify_pending',
          notifyAttempts: attempts,
          lastError: message,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(taskRun.id, row.id));
      await this.auditService.write({
        action: 'task_failed',
        entityType: 'task_run',
        entityId: row.id,
        entityName: row.taskTitle,
        summary: `「${row.taskTitle}」结果通知第 ${attempts} 次失败${giveUp ? '，转入待确认' : '，将自动重试'}：${message}`,
      });
    }
  }

  private async markFailure(
    row: typeof taskRun.$inferSelect,
    message: string,
  ): Promise<void> {
    const retryCount = row.retryCount + 1;
    const giveUp = retryCount >= MAX_AUTO_RETRY;
    const nextRetryAt = new Date(
      Date.now() + RETRY_BASE_DELAY_MINUTES * 60_000 * 2 ** (retryCount - 1),
    );
    await this.db
      .update(taskRun)
      .set({
        status: giveUp ? 'needs_review' : 'failed',
        retryCount,
        nextRetryAt: giveUp ? null : nextRetryAt,
        lastError: message,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(taskRun.id, row.id));
    await this.auditService.write({
      action: 'task_failed',
      entityType: 'task_run',
      entityId: row.id,
      entityName: row.taskTitle,
      summary: `「${row.taskTitle}」执行失败（第 ${retryCount} 次）${giveUp ? '，转入待确认' : `，${nextRetryAt.toISOString()} 后自动重试`}：${message}`,
    });
  }

  async cancelMatching(
    ruleId: string,
    objectKey: string,
    cancelScope: string,
    userId: string,
  ): Promise<number> {
    const conditions: SQL[] = [
      eq(taskRun.ruleId, ruleId),
      inArray(taskRun.status, ['pending', 'notify_pending']),
    ];
    if (cancelScope === 'object' && objectKey !== '') {
      conditions.push(eq(taskRun.objectKey, objectKey));
    }
    const cancelled = await this.db
      .update(taskRun)
      .set({ status: 'cancelled', leaseExpiresAt: null, updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: taskRun.id, taskTitle: taskRun.taskTitle });
    for (const item of cancelled) {
      await this.auditService.write({
        action: 'task_cancelled',
        entityType: 'task_run',
        entityId: item.id,
        entityName: item.taskTitle,
        summary: `命中取消词，取消待执行任务「${item.taskTitle}」（范围：${cancelScope === 'object' ? '同一业务对象' : '整个规则'}）`,
        userId,
      });
    }
    return cancelled.length;
  }
}

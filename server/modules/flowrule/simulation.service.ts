import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, gte } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { simulationRun, workspace } from '@server/database/schema';
import type {
  OpenapiSimulateResponse,
  Rule,
  SimulationInput,
  SimulationRun,
} from '@shared/api.interface';
import { normalizeRuleConfig, simulateRule } from './engine';
import { RulesService } from './rules.service';
import { ConnectorsService } from './connectors.service';
import { AuditService } from './audit.service';

const DEFAULT_INPUT: SimulationInput = {
  messageText: '',
  sender: '成员A',
  senderRole: 'member',
  mentions: [],
  sentAt: new Date().toISOString(),
  replyDepth: 0,
  sourceGroup: '',
  messageId: `om_demo_${Date.now()}`,
  messageType: 'text',
};

export const normalizeSimulationInput = (raw: unknown): SimulationInput => {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const mentions = Array.isArray(src.mentions)
    ? src.mentions.filter((m): m is string => typeof m === 'string')
    : [];
  const sentAt =
    typeof src.sentAt === 'string' && !Number.isNaN(new Date(src.sentAt).getTime())
      ? src.sentAt
      : DEFAULT_INPUT.sentAt;
  return {
    messageText: typeof src.messageText === 'string' ? src.messageText : '',
    sender: typeof src.sender === 'string' && src.sender ? src.sender : '成员A',
    senderRole:
      src.senderRole === 'admin' || src.senderRole === 'bot' || src.senderRole === 'any'
        ? src.senderRole
        : 'member',
    mentions,
    sentAt,
    replyDepth: typeof src.replyDepth === 'number' && src.replyDepth >= 0 ? src.replyDepth : 0,
    sourceGroup: typeof src.sourceGroup === 'string' ? src.sourceGroup : '',
    messageId: typeof src.messageId === 'string' && src.messageId ? src.messageId : 'om_demo_default',
    messageType:
      src.messageType === 'post' || src.messageType === 'file' || src.messageType === 'image' || src.messageType === 'any'
        ? src.messageType
        : 'text',
  };
};

const toRun = (row: typeof simulationRun.$inferSelect): SimulationRun => ({
  id: row.id,
  ruleId: row.ruleId,
  ruleName: row.ruleName,
  ruleVersionLabel: row.ruleVersionLabel,
  input: JSON.parse(row.input),
  result: JSON.parse(row.result),
  isDemo: row.isDemo,
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy ?? '',
});

@Injectable()
export class SimulationService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly rulesService: RulesService,
    private readonly connectorsService: ConnectorsService,
    private readonly auditService: AuditService,
  ) {}

  async run(
    ruleId: string,
    rawInput: unknown,
    userId: string,
  ): Promise<SimulationRun> {
    const rule = await this.rulesService.get(ruleId);
    return this.executeAndPersist(rule, rawInput, { isDemo: false, userId });
  }

  async runByCode(
    ruleCode: string,
    rawEvent: unknown,
  ): Promise<OpenapiSimulateResponse> {
    const rule = await this.rulesService.getByCode(ruleCode);
    const run = await this.executeAndPersist(rule, rawEvent, {
      isDemo: true,
      source: 'OpenAPI',
    });
    return {
      ruleCode: rule.code,
      ruleName: rule.name,
      ruleVersion: rule.currentVersion,
      isDemo: true,
      note: '模拟结果由本地确定性规则引擎评估：不调用飞书、不创建真实任务。',
      decision: run.result,
    };
  }

  private async executeAndPersist(
    rule: Rule,
    rawInput: unknown,
    opts: { isDemo: boolean; userId?: string; source?: string },
  ): Promise<SimulationRun> {
    const input = normalizeSimulationInput(rawInput);
    const timezone = await this.resolveTimezone(rule);
    const result = simulateRule(
      { ...rule, config: normalizeRuleConfig(rule.config) },
      input,
      timezone,
    );
    const versionLabel =
      rule.currentVersion > 0 && rule.status === 'published'
        ? `v${rule.currentVersion}`
        : '草稿';
    const [row] = await this.db
      .insert(simulationRun)
      .values({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleVersionLabel: versionLabel,
        input: JSON.stringify(input),
        result: JSON.stringify(result),
        isDemo: opts.isDemo,
      })
      .returning();
    const origin = opts.source ? `，来源：${opts.source}` : '';
    await this.auditService.write({
      action: 'simulation_run',
      entityType: 'simulation',
      entityId: row.id,
      entityName: rule.name,
      summary: `模拟测试规则「${rule.name}」：${result.matched ? '命中' : '未命中'}（${versionLabel}）${origin}`,
      userId: opts.userId,
    });
    return toRun(row);
  }

  private async resolveTimezone(rule: { config: { sourceConnectorId: string | null } }): Promise<string> {
    const connectorId = rule.config.sourceConnectorId;
    if (connectorId) {
      const map = await this.connectorsService.getTimezoneMap();
      if (map[connectorId]) return map[connectorId];
    }
    const [ws] = await this.db.select().from(workspace);
    return ws?.defaultTimezone ?? 'Asia/Shanghai';
  }

  async list(ruleId?: string, limit = 50): Promise<SimulationRun[]> {
    const rows = ruleId
      ? await this.db
          .select()
          .from(simulationRun)
          .where(eq(simulationRun.ruleId, ruleId))
          .orderBy(desc(simulationRun.createdAt))
          .limit(limit)
      : await this.db
          .select()
          .from(simulationRun)
          .orderBy(desc(simulationRun.createdAt))
          .limit(limit);
    return rows.map(toRun);
  }

  async statsForDashboard(): Promise<{
    simulations7d: number;
    simulationHits7d: number;
    simulationFailures7d: number;
    recent: { id: string; ruleName: string; matched: boolean; isDemo: boolean; createdAt: string }[];
  }> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.db
      .select()
      .from(simulationRun)
      .where(gte(simulationRun.createdAt, since));
    const recentRows = await this.db
      .select()
      .from(simulationRun)
      .orderBy(desc(simulationRun.createdAt))
      .limit(5);
    let hits = 0;
    for (const row of rows) {
      const result = JSON.parse(row.result) as { matched: boolean };
      if (result.matched) hits += 1;
    }
    return {
      simulations7d: rows.length,
      simulationHits7d: hits,
      simulationFailures7d: rows.length - hits,
      recent: recentRows.map((row) => ({
        id: row.id,
        ruleName: row.ruleName,
        matched: (JSON.parse(row.result) as { matched: boolean }).matched,
        isDemo: row.isDemo,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

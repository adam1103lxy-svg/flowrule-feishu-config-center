import { Inject, Injectable, Logger } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  auditLog,
  connector,
  rule,
  ruleVersion,
  simulationRun,
  workspace,
} from '@server/database/schema';
import type {
  RuleConfig,
  SimulationInput,
} from '@shared/api.interface';
import { normalizeRuleConfig, simulateRule } from './engine';

interface SeedRuleDef {
  name: string;
  code: string;
  description: string;
  type: string;
  status: 'draft' | 'published' | 'disabled' | 'failed';
  config: RuleConfig;
  changelog?: string;
  extraVersions?: { changelog: string; config?: RuleConfig }[];
}

const DEMO_CONNECTORS = [
  {
    name: '生产 · 飞书主连接器',
    environment: 'prod',
    feishuAppId: 'cli_a1b2c3d4e5f60g78',
    credentialRef: 'secret-manager://team/feishu-prod',
    sourceGroups: ['客服支持群', '发布值班群', '配置变更通知群'],
    notifyGroups: ['配置变更通知群', '任务提醒群'],
    timezone: 'Asia/Shanghai',
    ownerSource: 'contact',
    scanPeriodMinutes: 5,
    status: 'active',
  },
  {
    name: '测试 · 沙箱连接器',
    environment: 'test',
    feishuAppId: 'cli_t9s8r7q6p5o4n321',
    credentialRef: '',
    sourceGroups: ['测试沙箱群'],
    notifyGroups: ['测试沙箱群'],
    timezone: 'Asia/Shanghai',
    ownerSource: 'manual',
    scanPeriodMinutes: 15,
    status: 'inactive',
  },
];

const triggerCond = (
  type: 'keyword' | 'regex' | 'sender_role' | 'must_mention' | 'message_type' | 'reply_depth',
  extra: Record<string, unknown> = {},
) => ({ type, ...extra });

const baseConfig: Pick<
  RuleConfig,
  | 'taskTitleTemplate'
  | 'taskDescTemplate'
  | 'cancelWords'
  | 'cancelScope'
  | 'failureAction'
  | 'retryCount'
> = {
  taskTitleTemplate: '【{{rule_name}}】处理 {{object_key}}',
  taskDescTemplate:
    '来自 {{source_group}} 的 {{sender}} 触发规则 {{rule_name}}，业务对象 {{object_key}}{{object_version}}，请及时处理。',
  cancelWords: ['取消', '撤回', '不用处理'],
  cancelScope: 'rule',
  failureAction: 'pending_confirm',
  retryCount: 2,
};

const DEMO_RULES: SeedRuleDef[] = [
  {
    name: '手动指派 · 群消息转工单',
    code: 'manual_assign_v1',
    description: '群里出现「提单/工单」并 @ 成员时，指派被@人处理工单。',
    type: 'manual_assign',
    status: 'published',
    changelog: '调整去重键为消息ID+规则ID，支持版本提取',
    extraVersions: [
      { changelog: '首个版本：关键词 + 必须@ 触发，指派被@人' },
      { changelog: '新增取消词与失败进入待确认' },
    ],
    config: {
      ...baseConfig,
      sourceConnectorId: 'PLACEHOLDER_PROD',
      sourceGroups: ['客服支持群'],
      trigger: {
        match: 'all',
        conditions: [
          triggerCond('keyword', { keywords: ['提单', '工单'] }),
          triggerCond('must_mention'),
        ],
      },
      exclusions: {
        match: 'any',
        conditions: [triggerCond('keyword', { keywords: ['测试', '演练'] })],
      },
      extraction: {
        objectLabel: '工单',
        objectPattern: '工单号[:：]\\s*([A-Z]{2}-\\d{4,6})',
        versionPattern: '版本\\s*(v\\d+\\.\\d+\\.\\d+)',
      },
      assignee: { mode: 'mention', fallback: '值班成员' },
      timing: { mode: 'immediate' },
      notifyTargets: [{ type: 'source_group' }, { type: 'notify_group', value: '任务提醒群' }],
      dedupFields: ['message_id', 'rule_id'],
    },
  },
  {
    name: '账户配置 · 变更二次确认',
    code: 'account_config_v1',
    description: '识别账户配置变更消息，30 分钟后向静态负责人确认。',
    type: 'account_config',
    status: 'published',
    changelog: '首个版本：正则触发 + 相对延迟 30 分钟',
    config: {
      ...baseConfig,
      sourceConnectorId: 'PLACEHOLDER_PROD',
      sourceGroups: ['配置变更通知群'],
      trigger: {
        match: 'any',
        conditions: [
          triggerCond('regex', { pattern: '账户配置.*(变更|修改|调整)' }),
          triggerCond('keyword', { keywords: ['改密', '权限调整'] }),
        ],
      },
      exclusions: { match: 'all', conditions: [] },
      extraction: {
        objectLabel: '配置项',
        objectPattern: '配置项[:：]\\s*([\\w-]+)',
      },
      assignee: { mode: 'static', staticUsers: ['成员A', '成员B'] },
      timing: { mode: 'relative_delay', delayMinutes: 30 },
      notifyTargets: [{ type: 'notify_group', value: '任务提醒群' }],
      dedupFields: ['object_key', 'rule_id'],
    },
  },
  {
    name: '提审 · PR 提交审核提醒',
    code: 'submission_review_v1',
    description: '管理员在群里提交 PR 提审时，次日 10 点提醒发送者跟进审核。',
    type: 'submission_review',
    status: 'draft',
    config: {
      ...baseConfig,
      sourceConnectorId: 'PLACEHOLDER_PROD',
      sourceGroups: ['发布值班群'],
      trigger: {
        match: 'all',
        conditions: [
          triggerCond('keyword', { keywords: ['提审', '提交审核'] }),
          triggerCond('sender_role', { senderRole: 'admin' }),
        ],
      },
      exclusions: { match: 'any', conditions: [triggerCond('keyword', { keywords: ['跳过审核'] })] },
      extraction: {
        objectLabel: 'PR',
        objectPattern: 'PR-(\\d{3,6})',
      },
      assignee: { mode: 'sender' },
      timing: { mode: 'fixed_next_day', fixedTime: '10:00' },
      notifyTargets: [{ type: 'source_group' }, { type: 'user', value: '发送者' }],
      dedupFields: ['object_key', 'rule_id'],
    },
  },
  {
    name: '发布 · 上线完成通知',
    code: 'publish_v1',
    description: '识别发布完成消息，按外部映射表派值班同学同步结果。',
    type: 'publish',
    status: 'published',
    changelog: 'v3：映射表补充 P1 级别；v2：通知目标增加值班群',
    extraVersions: [
      { changelog: '首个版本' },
      { changelog: '通知目标增加值班群' },
    ],
    config: {
      ...baseConfig,
      sourceConnectorId: 'PLACEHOLDER_PROD',
      sourceGroups: ['发布值班群'],
      trigger: {
        match: 'any',
        conditions: [
          triggerCond('keyword', { keywords: ['发布完成', '上线成功'] }),
          triggerCond('regex', { pattern: 'release.*(done|success)' }),
        ],
      },
      exclusions: { match: 'all', conditions: [] },
      extraction: {
        objectLabel: '发布单',
        objectPattern: '发布单[:：]\\s*(\\d{4,6})',
      },
      assignee: {
        mode: 'external_map',
        externalMap: [
          { key: '1001', user: '值班成员A' },
          { key: '1002', user: '值班成员B' },
        ],
        fallback: '值班成员A',
      },
      timing: { mode: 'immediate' },
      notifyTargets: [{ type: 'notify_group', value: '任务提醒群' }],
      dedupFields: ['object_key', 'rule_id', 'source_group'],
    },
  },
  {
    name: '24小时检查 · 工单未响应升级',
    code: 'check_24h_v1',
    description: '识别工单消息，24 小时后检查响应情况（当前停用）。',
    type: 'check_24h',
    status: 'disabled',
    config: {
      ...baseConfig,
      sourceConnectorId: 'PLACEHOLDER_PROD',
      sourceGroups: ['客服支持群'],
      trigger: {
        match: 'all',
        conditions: [
          triggerCond('regex', { pattern: '工单号[:：]\\s*[A-Z]{2}-\\d{4,6}' }),
          triggerCond('reply_depth', { replyDepth: 1 }),
        ],
      },
      exclusions: { match: 'all', conditions: [] },
      extraction: {
        objectLabel: '工单',
        objectPattern: '工单号[:：]\\s*([A-Z]{2}-\\d{4,6})',
      },
      assignee: { mode: 'static', staticUsers: ['成员B'] },
      timing: { mode: 'relative_delay', delayMinutes: 1440 },
      notifyTargets: [{ type: 'notify_group', value: '任务提醒群' }],
      dedupFields: ['object_key', 'rule_id', 'source_group'],
    },
  },
  {
    name: '72小时复盘 · 发布后回顾',
    code: 'retrospective_72h_v1',
    description: '群里出现复盘诉求时，次日 9:30 建立复盘提醒并 @ 提出者。',
    type: 'retrospective_72h',
    status: 'draft',
    config: {
      ...baseConfig,
      sourceConnectorId: 'PLACEHOLDER_PROD',
      sourceGroups: ['发布值班群'],
      trigger: {
        match: 'all',
        conditions: [
          triggerCond('keyword', { keywords: ['复盘', '回顾'] }),
          triggerCond('must_mention'),
        ],
      },
      exclusions: { match: 'all', conditions: [] },
      extraction: {
        objectLabel: '发布单',
        objectPattern: '发布单[:：]\\s*(\\d{4,6})',
      },
      assignee: { mode: 'mention', fallback: '值班成员A' },
      timing: { mode: 'fixed_next_day', fixedTime: '09:30' },
      notifyTargets: [{ type: 'source_group' }],
      dedupFields: ['object_key', 'rule_id'],
    },
  },
  {
    name: '报销异常 · 财务群拦截（未完成）',
    code: 'expense_guard_v1',
    description: '演示校验失败态：尚未配置去重键，发布会被阻断。',
    type: 'custom',
    status: 'failed',
    config: {
      ...baseConfig,
      taskTitleTemplate: '【报销异常】{{object_key}} 待人工确认',
      sourceConnectorId: 'PLACEHOLDER_TEST',
      sourceGroups: ['测试沙箱群'],
      trigger: {
        match: 'any',
        conditions: [triggerCond('keyword', { keywords: ['报销'] })],
      },
      exclusions: { match: 'all', conditions: [] },
      extraction: null,
      assignee: { mode: 'static', staticUsers: ['成员A'] },
      timing: { mode: 'immediate' },
      notifyTargets: [{ type: 'notify_group', value: '测试沙箱群' }],
      dedupFields: [],
    },
  },
];

const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3600_000);

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private seeding: Promise<void> | null = null;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async ensureSeeded(): Promise<void> {
    if (!this.seeding) {
      this.seeding = this.doSeed().catch((error: unknown) => {
        this.seeding = null;
        throw error;
      });
    }
    return this.seeding;
  }

  private async doSeed(): Promise<void> {
    const [{ total }] = await this.db.select({ total: count() }).from(workspace);
    if (total > 0) return;
    this.logger.log('首次访问，生成匿名 Demo 数据…');

    await this.db.insert(workspace).values({
      name: 'FlowRule 演示工作区',
      defaultTimezone: 'Asia/Shanghai',
      defaultScanPeriodMinutes: 5,
      pendingConfirmPolicy: '失败任务进入待确认列表，由规则负责人人工重试或关闭',
      securityNote:
        '本配置平台不保存真实 Secret/Token，仅记录非敏感凭证引用（credentialRef）；妙搭 Open API Key 由应用管理员在平台侧创建、仅展示一次，本应用界面不管理密钥。演示环境不内置真实密钥。',
      createdBy: null,
      updatedBy: null,
    });

    const connectorRows = await this.db
      .insert(connector)
      .values(DEMO_CONNECTORS.map((c) => ({ ...c, createdBy: null, updatedBy: null })))
      .returning();
    const prodConnectorId = connectorRows[0].id;

    const ruleIdByCode: Record<string, string> = {};
    const configByCode: Record<string, RuleConfig> = {};
    for (const def of DEMO_RULES) {
      const config = { ...def.config };
      if (config.sourceConnectorId === 'PLACEHOLDER_PROD') config.sourceConnectorId = prodConnectorId;
      if (config.sourceConnectorId === 'PLACEHOLDER_TEST') config.sourceConnectorId = connectorRows[1].id;
      configByCode[def.code] = config;
      const publishedAt = def.status === 'published' ? hoursAgo(72) : hoursAgo(48);
      const versionCount = def.status === 'published' ? (def.extraVersions?.length ?? 0) + 1 : 0;
      const [ruleRow] = await this.db
        .insert(rule)
        .values({
          name: def.name,
          code: def.code,
          description: def.description,
          type: def.type,
          status: def.status,
          currentVersion: versionCount,
          config: JSON.stringify(config),
          createdAt: publishedAt,
          updatedAt: publishedAt,
          createdBy: null,
          updatedBy: null,
        })
        .returning();
      ruleIdByCode[def.code] = ruleRow.id;

      if (def.status === 'published') {
        const extra = def.extraVersions ?? [];
        for (let i = 0; i < extra.length; i += 1) {
          const v = i + 1;
          const cfg = extra[i].config ?? config;
          await this.db.insert(ruleVersion).values({
            ruleId: ruleRow.id,
            version: v,
            config: JSON.stringify(cfg),
            changelog: extra[i].changelog,
            createdAt: hoursAgo(72 - v * 2),
            createdBy: null,
            updatedBy: null,
          });
        }
        await this.db.insert(ruleVersion).values({
          ruleId: ruleRow.id,
          version: versionCount,
          config: JSON.stringify(config),
          changelog: def.changelog ?? `发布 v${versionCount}`,
          createdAt: hoursAgo(24),
          createdBy: null,
          updatedBy: null,
        });
        await this.db.insert(auditLog).values({
          action: 'rule_published',
          entityType: 'rule',
          entityId: ruleRow.id,
          entityName: def.name,
          summary: `规则「${def.name}」发布新版本 v${versionCount}`,
          detail: def.changelog ?? '',
          isDemo: true,
          createdAt: hoursAgo(24),
          createdBy: null,
        });
      }
      await this.db.insert(auditLog).values({
        action: 'rule_created',
        entityType: 'rule',
        entityId: ruleRow.id,
        entityName: def.name,
        summary: `创建规则「${def.name}」（${def.code}）`,
        detail: '',
        isDemo: true,
        createdAt: hoursAgo(72),
        createdBy: null,
      });
    }

    for (const row of connectorRows) {
      await this.db.insert(auditLog).values({
        action: 'connector_created',
        entityType: 'connector',
        entityId: row.id,
        entityName: row.name,
        summary: `创建连接器「${row.name}」`,
        detail: '',
        isDemo: true,
        createdAt: hoursAgo(96),
        createdBy: null,
      });
    }

    await this.seedSimulationRuns(ruleIdByCode, configByCode);

    this.logger.log('Demo 数据生成完成');
  }

  private async seedSimulationRuns(
    ruleIdByCode: Record<string, string>,
    configByCode: Record<string, RuleConfig>,
  ): Promise<void> {
    const cases: { code: string; input: SimulationInput; label: string }[] = [
      {
        code: 'manual_assign_v1',
        label: '正例',
        input: {
          messageText: '@成员A 帮我提个单，工单号：SR-10231，版本 v2.3.0',
          sender: '成员C',
          senderRole: 'member',
          mentions: ['成员A'],
          sentAt: hoursAgo(30).toISOString(),
          replyDepth: 0,
          sourceGroup: '客服支持群',
          messageId: 'om_demo_sr10231',
          messageType: 'text',
        },
      },
      {
        code: 'manual_assign_v1',
        label: '反例',
        input: {
          messageText: '今天天气不错，中午吃什么',
          sender: '成员C',
          senderRole: 'member',
          mentions: [],
          sentAt: hoursAgo(29).toISOString(),
          replyDepth: 0,
          sourceGroup: '客服支持群',
          messageId: 'om_demo_chat',
          messageType: 'text',
        },
      },
      {
        code: 'manual_assign_v1',
        label: '重复例',
        input: {
          messageText: '@成员A 帮我提个单，工单号：SR-10231，版本 v2.3.0',
          sender: '成员C',
          senderRole: 'member',
          mentions: ['成员A'],
          sentAt: hoursAgo(28).toISOString(),
          replyDepth: 0,
          sourceGroup: '客服支持群',
          messageId: 'om_demo_sr10231',
          messageType: 'text',
        },
      },
      {
        code: 'account_config_v1',
        label: '正例',
        input: {
          messageText: '账户配置 变更 完成：配置项：audit-log-retention',
          sender: '成员B',
          senderRole: 'admin',
          mentions: [],
          sentAt: hoursAgo(52).toISOString(),
          replyDepth: 1,
          sourceGroup: '配置变更通知群',
          messageId: 'om_demo_cfg1',
          messageType: 'text',
        },
      },
      {
        code: 'publish_v1',
        label: '正例',
        input: {
          messageText: '发布完成：发布单：1001，无回滚',
          sender: '成员D',
          senderRole: 'admin',
          mentions: [],
          sentAt: hoursAgo(20).toISOString(),
          replyDepth: 0,
          sourceGroup: '发布值班群',
          messageId: 'om_demo_rel1001',
          messageType: 'text',
        },
      },
      {
        code: 'publish_v1',
        label: '反例',
        input: {
          messageText: '发布单：1001 准备中，还没开始',
          sender: '成员D',
          senderRole: 'admin',
          mentions: [],
          sentAt: hoursAgo(19).toISOString(),
          replyDepth: 0,
          sourceGroup: '发布值班群',
          messageId: 'om_demo_rel1001_pre',
          messageType: 'text',
        },
      },
    ];

    let index = 0;
    for (const item of cases) {
      const ruleId = ruleIdByCode[item.code];
      const config = configByCode[item.code];
      if (!ruleId || !config) continue;
      const ruleDef = DEMO_RULES.find((d) => d.code === item.code);
      const normalized = normalizeRuleConfig(config);
      const result = simulateRule(
        {
          id: ruleId,
          name: ruleDef?.name ?? item.code,
          code: item.code,
          description: '',
          type: 'custom',
          status: 'draft',
          currentVersion: 0,
          config: normalized,
          createdAt: '',
          updatedAt: '',
        },
        item.input,
        'Asia/Shanghai',
      );
      await this.db.insert(simulationRun).values({
        ruleId,
        ruleName: ruleDef?.name ?? item.code,
        ruleVersionLabel: 'Demo',
        input: JSON.stringify(item.input),
        result: JSON.stringify(result),
        isDemo: true,
        createdAt: hoursAgo(6 * (index + 1)),
        createdBy: null,
        updatedBy: null,
      });
      await this.db.insert(auditLog).values({
        action: 'simulation_run',
        entityType: 'simulation',
        entityId: `demo-${index}`,
        entityName: ruleDef?.name ?? item.code,
        summary: `模拟测试规则「${ruleDef?.name ?? item.code}」（${item.label}）：${result.matched ? '命中' : '未命中'}`,
        detail: '',
        isDemo: true,
        createdAt: hoursAgo(6 * (index + 1)),
        createdBy: null,
      });
      index += 1;
    }
  }
}

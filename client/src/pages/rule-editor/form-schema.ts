import { z } from 'zod';
import {
  ASSIGNER_MODES,
  CANCEL_SCOPES,
  CONDITION_TYPES,
  DEDUP_FIELDS,
  DUE_POLICY_MODES,
  FAILURE_ACTIONS,
  MESSAGE_TYPES,
  RULE_ACTIONS,
  SENDER_ROLES,
  TIMING_MODES,
  type ConditionType,
  type NotifyTarget,
  type Rule,
  type RuleConfig,
  type RuleCondition,
  type SenderRole,
  type MessageType,
} from '@shared/api.interface';

/* ===== 正则工具 ===== */

export const isValidRegex = (pattern: string): boolean => {
  try {
    void new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;
const CODE_PATTERN = /^[A-Za-z0-9_]+$/u;

/* ===== 表单 Schema ===== */

export const conditionFormSchema = z
  .object({
    type: z.enum(CONDITION_TYPES),
    keywords: z.array(z.string()),
    pattern: z.string(),
    senderRole: z.enum(SENDER_ROLES),
    messageType: z.enum(MESSAGE_TYPES),
    replyDepth: z
      .number({ message: '请输入有效数字' })
      .int('需为整数')
      .min(0, '回复链深度不能为负'),
  })
  .superRefine((c, ctx) => {
    if (c.type === 'keyword' && c.keywords.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: '请至少添加一个关键词',
        path: ['keywords'],
      });
    }
    if (c.type === 'regex') {
      if (!c.pattern) {
        ctx.addIssue({
          code: 'custom',
          message: '请输入正则表达式',
          path: ['pattern'],
        });
      } else if (!isValidRegex(c.pattern)) {
        ctx.addIssue({ code: 'custom', message: '正则无效', path: ['pattern'] });
      }
    }
  });

const conditionGroupFormSchema = z.object({
  match: z.enum(['all', 'any']),
  conditions: z.array(conditionFormSchema),
});

export const ruleFormSchema = z
  .object({
    name: z.string().min(1, '请输入规则名称'),
    code: z
      .string()
      .min(1, '请输入规则标识')
      .regex(CODE_PATTERN, '仅支持英文字母、数字与下划线'),
    description: z.string(),
    type: z.enum([
      'manual_assign',
      'account_config',
      'submission_review',
      'publish',
      'check_24h',
      'retrospective_72h',
      'custom',
    ]),
    sourceConnectorId: z.string(),
    sourceGroups: z.array(z.string()),
    action: z.enum(RULE_ACTIONS),
    sourceChatId: z.string(),
    sourceChatName: z.string(),
    notifyChatId: z.string(),
    notifyChatName: z.string(),
    allowedSenders: z.array(
      z.object({
        name: z.string(),
        openId: z.string(),
      }),
    ),
    trigger: conditionGroupFormSchema,
    exclusions: conditionGroupFormSchema,
    extractionEnabled: z.boolean(),
    extraction: z.object({
      objectLabel: z.string(),
      objectPattern: z.string(),
      versionPattern: z.string(),
      releaseRatioPattern: z.string(),
    }),
    assigneeMode: z.enum([
      'none',
      'mention_first_else_sender',
      'mention',
      'sender',
      'static',
      'external_map',
    ]),
    staticUsers: z.array(z.string()),
    externalMap: z.array(
      z.object({
        key: z.string(),
        user: z.string(),
      }),
    ),
    assigneeFallback: z.string(),
    timingMode: z.enum(TIMING_MODES),
    delayMinutes: z
      .number({ message: '请输入有效数字' })
      .int('需为整数')
      .min(0, '延迟分钟数不能为负'),
    fixedTime: z.string(),
    dueAtMode: z.enum(DUE_POLICY_MODES),
    dueAtDelayMinutes: z
      .string()
      .refine((v: string) => v === '' || /^\d+$/u.test(v), '请输入有效数字'),
    dueAtFixedTime: z.string(),
    taskTitleTemplate: z.string().min(1, '请输入待办标题模板'),
    taskDescTemplate: z.string(),
    dedupFields: z.array(z.enum(DEDUP_FIELDS)),
    cancelWords: z.array(z.string()),
    cancelScope: z.enum(CANCEL_SCOPES),
    failureAction: z.enum(FAILURE_ACTIONS),
    retryCount: z
      .number({ message: '请输入有效数字' })
      .int('需为整数')
      .min(0, '重试次数不能为负')
      .max(10, '重试次数不能超过 10'),
  })
  .superRefine((data, ctx) => {
    if (data.trigger.conditions.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: '至少需要一条触发条件',
        path: ['trigger', 'conditions'],
      });
    }
    if (data.extractionEnabled) {
      const { objectPattern, versionPattern } = data.extraction;
      if (!objectPattern) {
        ctx.addIssue({
          code: 'custom',
          message: '请输入业务对象提取正则',
          path: ['extraction', 'objectPattern'],
        });
      } else if (!isValidRegex(objectPattern)) {
        ctx.addIssue({
          code: 'custom',
          message: '正则无效',
          path: ['extraction', 'objectPattern'],
        });
      }
      if (versionPattern && !isValidRegex(versionPattern)) {
        ctx.addIssue({
          code: 'custom',
          message: '正则无效',
          path: ['extraction', 'versionPattern'],
        });
      }
      if (
        data.extraction.releaseRatioPattern &&
        !isValidRegex(data.extraction.releaseRatioPattern)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: '正则无效',
          path: ['extraction', 'releaseRatioPattern'],
        });
      }
    }
    if (data.assigneeMode === 'static' && data.staticUsers.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: '请至少添加一名静态人员',
        path: ['staticUsers'],
      });
    }
    if (data.assigneeMode === 'external_map') {
      const rows = data.externalMap.filter(
        (row: { key: string; user: string }) => row.key.trim() && row.user.trim(),
      );
      if (rows.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: '请至少配置一行外部映射（key 与人员均需填写）',
          path: ['externalMap'],
        });
      }
    }
    if (data.timingMode === 'fixed_next_day' && !TIME_PATTERN.test(data.fixedTime)) {
      ctx.addIssue({
        code: 'custom',
        message: '请按 HH:mm 格式输入有效时间，如 09:30',
        path: ['fixedTime'],
      });
    }
    if (data.timingMode === 'relative_delay' && !(data.delayMinutes > 0)) {
      ctx.addIssue({
        code: 'custom',
        message: '请输入大于 0 的延迟分钟数',
        path: ['delayMinutes'],
      });
    }
    data.allowedSenders.forEach((row, index) => {
      const hasName = row.name.trim() !== '';
      const hasOpenId = row.openId.trim() !== '';
      if (hasName !== hasOpenId) {
        ctx.addIssue({
          code: 'custom',
          message: '姓名与 open_id 需成对填写',
          path: ['allowedSenders', index, 'openId'],
        });
      } else if (hasOpenId && !row.openId.trim().startsWith('ou_')) {
        ctx.addIssue({
          code: 'custom',
          message: 'open_id 需以 ou_ 开头',
          path: ['allowedSenders', index, 'openId'],
        });
      }
    });
    if (
      data.dueAtMode === 'relative_minutes' &&
      (!/^\d+$/u.test(data.dueAtDelayMinutes) ||
        Number(data.dueAtDelayMinutes) <= 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '请输入大于 0 的延迟分钟数',
        path: ['dueAtDelayMinutes'],
      });
    }
    if (
      data.dueAtMode === 'fixed_next_day' &&
      !TIME_PATTERN.test(data.dueAtFixedTime)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '请按 HH:mm 格式输入有效时间，如 18:00',
        path: ['dueAtFixedTime'],
      });
    }
  });

export type RuleFormValues = z.infer<typeof ruleFormSchema>;
export type RuleConditionFormValues = z.infer<typeof conditionFormSchema>;

/* ===== 默认值与转换 ===== */

export const createEmptyCondition = (): RuleConditionFormValues => ({
  type: 'keyword',
  keywords: [],
  pattern: '',
  senderRole: 'any',
  messageType: 'any',
  replyDepth: 0,
});

export const createDefaultFormValues = (): RuleFormValues => ({
  name: '',
  code: '',
  description: '',
  type: 'manual_assign',
  sourceConnectorId: '',
  sourceGroups: [],
  action: 'create_task',
  sourceChatId: '',
  sourceChatName: '',
  notifyChatId: '',
  notifyChatName: '',
  allowedSenders: [{ name: '', openId: '' }],
  trigger: { match: 'all', conditions: [createEmptyCondition()] },
  exclusions: { match: 'all', conditions: [] },
  extractionEnabled: false,
  extraction: {
    objectLabel: '',
    objectPattern: '',
    versionPattern: '',
    releaseRatioPattern: '',
  },
  assigneeMode: 'mention_first_else_sender',
  staticUsers: [],
  externalMap: [{ key: '', user: '' }],
  assigneeFallback: '',
  timingMode: 'immediate',
  delayMinutes: 30,
  fixedTime: '09:00',
  dueAtMode: 'none',
  dueAtDelayMinutes: '30',
  dueAtFixedTime: '18:00',
  taskTitleTemplate: '{{rule_name}}',
  taskDescTemplate: '',
  dedupFields: [],
  cancelWords: [],
  cancelScope: 'rule',
  failureAction: 'pending_confirm',
  retryCount: 3,
});

const toConditionFormValues = (c: RuleCondition): RuleConditionFormValues => ({
  type: c.type,
  keywords: c.keywords ?? [],
  pattern: c.pattern ?? '',
  senderRole: c.senderRole ?? 'any',
  messageType: c.messageType ?? 'any',
  replyDepth: c.replyDepth ?? 0,
});

export const buildFormValues = (rule: Rule): RuleFormValues => ({
  name: rule.name,
  code: rule.code,
  description: rule.description ?? '',
  type: rule.type,
  sourceConnectorId: rule.config.sourceConnectorId ?? '',
  sourceGroups: rule.config.sourceGroups ?? [],
  action: rule.config.action ?? 'create_task',
  sourceChatId: rule.config.sourceChatId ?? '',
  sourceChatName: rule.config.sourceChatName ?? '',
  notifyChatId:
    rule.config.notifyChatId ??
    rule.config.notifyTargets?.find((t) => t.type === 'notify_group')?.value ??
    '',
  notifyChatName: rule.config.notifyChatName ?? '',
  allowedSenders:
    rule.config.allowedSenders && rule.config.allowedSenders.length > 0
      ? rule.config.allowedSenders.map((s) => ({
          name: s.name,
          openId: s.openId,
        }))
      : [{ name: '', openId: '' }],
  trigger: {
    match: rule.config.trigger?.match ?? 'all',
    conditions: (rule.config.trigger?.conditions ?? []).map(toConditionFormValues),
  },
  exclusions: {
    match: rule.config.exclusions?.match ?? 'all',
    conditions: (rule.config.exclusions?.conditions ?? []).map(toConditionFormValues),
  },
  extractionEnabled: Boolean(rule.config.extraction),
  extraction: {
    objectLabel: rule.config.extraction?.objectLabel ?? '',
    objectPattern: rule.config.extraction?.objectPattern ?? '',
    versionPattern: rule.config.extraction?.versionPattern ?? '',
    releaseRatioPattern: rule.config.extraction?.releaseRatioPattern ?? '',
  },
  assigneeMode: rule.config.assignee?.mode ?? 'mention_first_else_sender',
  staticUsers: rule.config.assignee?.staticUsers ?? [],
  externalMap:
    rule.config.assignee?.externalMap && rule.config.assignee.externalMap.length > 0
      ? rule.config.assignee.externalMap.map((row) => ({ key: row.key, user: row.user }))
      : [{ key: '', user: '' }],
  assigneeFallback: rule.config.assignee?.fallback ?? '',
  timingMode: rule.config.timing?.mode ?? 'immediate',
  delayMinutes: rule.config.timing?.delayMinutes ?? 30,
  fixedTime: rule.config.timing?.fixedTime ?? '09:00',
  dueAtMode: rule.config.dueAt?.mode ?? 'none',
  dueAtDelayMinutes:
    rule.config.dueAt?.delayMinutes != null
      ? String(rule.config.dueAt.delayMinutes)
      : '30',
  dueAtFixedTime: rule.config.dueAt?.fixedTime ?? '18:00',
  taskTitleTemplate: rule.config.taskTitleTemplate ?? '',
  taskDescTemplate: rule.config.taskDescTemplate ?? '',
  dedupFields: rule.config.dedupFields ?? [],
  cancelWords: rule.config.cancelWords ?? [],
  cancelScope: rule.config.cancelScope ?? 'rule',
  failureAction: rule.config.failureAction ?? 'pending_confirm',
  retryCount: rule.config.retryCount ?? 0,
});

const toRuleCondition = (c: RuleConditionFormValues): RuleCondition => {
  const type: ConditionType = c.type;
  if (type === 'keyword') return { type, keywords: c.keywords };
  if (type === 'regex') return { type, pattern: c.pattern };
  if (type === 'sender_role')
    return { type, senderRole: c.senderRole as SenderRole };
  if (type === 'message_type')
    return { type, messageType: c.messageType as MessageType };
  if (type === 'reply_depth') return { type, replyDepth: c.replyDepth };
  return { type };
};

export const buildRuleConfig = (data: RuleFormValues): RuleConfig => {
  const assignee =
    data.assigneeMode === 'none'
      ? null
      : {
          mode: data.assigneeMode as (typeof ASSIGNER_MODES)[number],
          ...(data.assigneeMode === 'static' ? { staticUsers: data.staticUsers } : {}),
          ...(data.assigneeMode === 'external_map'
            ? {
                externalMap: data.externalMap
                  .filter((row) => row.key.trim() && row.user.trim())
                  .map((row) => ({ key: row.key.trim(), user: row.user.trim() })),
              }
            : {}),
          ...(data.assigneeFallback.trim()
            ? { fallback: data.assigneeFallback.trim() }
            : {}),
        };

  const timing = {
    mode: data.timingMode as (typeof TIMING_MODES)[number],
    ...(data.timingMode === 'relative_delay'
      ? { delayMinutes: data.delayMinutes }
      : {}),
    ...(data.timingMode === 'fixed_next_day' ? { fixedTime: data.fixedTime } : {}),
  };

  const dueAt =
    data.dueAtMode === 'none'
      ? null
      : {
          mode: data.dueAtMode,
          ...(data.dueAtMode === 'relative_minutes' && data.dueAtDelayMinutes
            ? { delayMinutes: Number(data.dueAtDelayMinutes) }
            : {}),
          ...(data.dueAtMode === 'fixed_next_day'
            ? { fixedTime: data.dueAtFixedTime }
            : {}),
        };

  const notifyTargets: NotifyTarget[] = data.notifyChatId.trim()
    ? [{ type: 'notify_group', value: data.notifyChatId.trim() }]
    : [];

  return {
    sourceConnectorId: data.sourceConnectorId || null,
    sourceGroups: data.sourceGroups,
    action: data.action,
    sourceChatId: data.sourceChatId.trim(),
    sourceChatName: data.sourceChatName.trim(),
    notifyChatId: data.notifyChatId.trim(),
    notifyChatName: data.notifyChatName.trim(),
    allowedSenders: data.allowedSenders
      .filter((row) => row.name.trim() && row.openId.trim())
      .map((row) => ({ name: row.name.trim(), openId: row.openId.trim() })),
    trigger: {
      match: data.trigger.match,
      conditions: data.trigger.conditions.map(toRuleCondition),
    },
    exclusions: {
      match: data.exclusions.match,
      conditions: data.exclusions.conditions.map(toRuleCondition),
    },
    extraction: data.extractionEnabled
      ? {
          objectPattern: data.extraction.objectPattern,
          ...(data.extraction.objectLabel.trim()
            ? { objectLabel: data.extraction.objectLabel.trim() }
            : {}),
          ...(data.extraction.versionPattern.trim()
            ? { versionPattern: data.extraction.versionPattern.trim() }
            : {}),
          ...(data.extraction.releaseRatioPattern.trim()
            ? { releaseRatioPattern: data.extraction.releaseRatioPattern.trim() }
            : {}),
        }
      : null,
    assignee,
    timing,
    dueAt,
    taskTitleTemplate: data.taskTitleTemplate,
    taskDescTemplate: data.taskDescTemplate,
    notifyTargets,
    dedupFields: data.dedupFields as (typeof DEDUP_FIELDS)[number][],
    cancelWords: data.cancelWords,
    cancelScope: data.cancelScope as (typeof CANCEL_SCOPES)[number],
    failureAction: data.failureAction as (typeof FAILURE_ACTIONS)[number],
    retryCount: data.retryCount,
  };
};

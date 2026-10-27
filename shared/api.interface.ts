/* 前后端共享类型 —— FlowRule 飞书规则配置中心 */

/* ===== 固定取值（前后端共用，取值数组只在此定义一次）===== */

export const RULE_STATUSES = ['draft', 'published', 'disabled', 'failed'] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];
export const isRuleStatus = (v: string): v is RuleStatus =>
  (RULE_STATUSES as readonly string[]).includes(v);
export const RULE_STATUS_LABELS: Record<RuleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用',
  failed: '校验失败',
};

export const RULE_TYPES = [
  'manual_assign',
  'account_config',
  'submission_review',
  'publish',
  'check_24h',
  'retrospective_72h',
  'custom',
] as const;
export type RuleType = (typeof RULE_TYPES)[number];
export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  manual_assign: '手动指派',
  account_config: '账户配置',
  submission_review: '提审',
  publish: '发布',
  check_24h: '24小时检查',
  retrospective_72h: '72小时复盘',
  custom: '自定义',
};

export const CONNECTOR_ENVS = ['prod', 'staging', 'test'] as const;
export type ConnectorEnv = (typeof CONNECTOR_ENVS)[number];
export const CONNECTOR_ENV_LABELS: Record<ConnectorEnv, string> = {
  prod: '生产',
  staging: '预发',
  test: '测试',
};

export const CONNECTOR_STATUSES = ['active', 'inactive'] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];
export const CONNECTOR_STATUS_LABELS: Record<ConnectorStatus, string> = {
  active: '启用',
  inactive: '停用',
};

export const EXECUTION_IDENTITIES = ['app', 'user'] as const;
export type ExecutionIdentity = (typeof EXECUTION_IDENTITIES)[number];
export const EXECUTION_IDENTITY_LABELS: Record<ExecutionIdentity, string> = {
  app: '应用身份',
  user: '用户身份',
};

export const OWNER_SOURCES = ['contact', 'external', 'manual'] as const;
export type OwnerSource = (typeof OWNER_SOURCES)[number];
export const OWNER_SOURCE_LABELS: Record<OwnerSource, string> = {
  contact: '通讯录',
  external: '外部系统',
  manual: '手动维护',
};

export const CONDITION_TYPES = [
  'keyword',
  'regex',
  'sender_role',
  'must_mention',
  'message_type',
  'reply_depth',
] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];
export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  keyword: '关键词',
  regex: '正则表达式',
  sender_role: '发送者角色',
  must_mention: '必须@',
  message_type: '消息类型',
  reply_depth: '回复链深度',
};

export const MESSAGE_TYPES = ['text', 'post', 'file', 'image', 'any'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  text: '文本',
  post: '富文本',
  file: '文件',
  image: '图片',
  any: '任意',
};

export const SENDER_ROLES = ['member', 'admin', 'bot', 'any'] as const;
export type SenderRole = (typeof SENDER_ROLES)[number];
export const SENDER_ROLE_LABELS: Record<SenderRole, string> = {
  member: '普通成员',
  admin: '群管理员',
  bot: '机器人',
  any: '任意',
};

export const ASSIGNER_MODES = [
  'mention_first_else_sender',
  'mention',
  'sender',
  'static',
  'external_map',
] as const;
export type AssignerMode = (typeof ASSIGNER_MODES)[number];
export const ASSIGNER_MODE_LABELS: Record<AssignerMode, string> = {
  mention_first_else_sender: '明确@一人优先，否则发送者',
  mention: '被@人',
  sender: '发送者',
  static: '静态人员',
  external_map: '外部映射',
};

export const TIMING_MODES = ['immediate', 'relative_delay', 'fixed_next_day'] as const;
export type TimingMode = (typeof TIMING_MODES)[number];
export const TIMING_MODE_LABELS: Record<TimingMode, string> = {
  immediate: '立即执行',
  relative_delay: '相对延迟',
  fixed_next_day: '固定次日时间',
};

export const DUE_POLICY_MODES = ['none', 'relative_minutes', 'fixed_next_day'] as const;
export type DuePolicyMode = (typeof DUE_POLICY_MODES)[number];
export const DUE_POLICY_MODE_LABELS: Record<DuePolicyMode, string> = {
  none: '不设置截止时间',
  relative_minutes: '创建后相对延迟',
  fixed_next_day: '固定次日时间',
};

export const RULE_ACTIONS = ['create_task'] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];
export const RULE_ACTION_LABELS: Record<RuleAction, string> = {
  create_task: '创建飞书待办',
};

export const NOTIFY_TARGET_TYPES = ['source_group', 'notify_group', 'user'] as const;
export type NotifyTargetType = (typeof NOTIFY_TARGET_TYPES)[number];
export const NOTIFY_TARGET_TYPE_LABELS: Record<NotifyTargetType, string> = {
  source_group: '来源群',
  notify_group: '通知群',
  user: '指定人员',
};

export const DEDUP_FIELDS = [
  'message_id',
  'object_key',
  'object_version',
  'release_ratio',
  'rule_id',
  'source_group',
  'sender',
] as const;
export type DedupField = (typeof DEDUP_FIELDS)[number];
export const DEDUP_FIELD_LABELS: Record<DedupField, string> = {
  message_id: '消息ID',
  object_key: '应用/业务对象',
  object_version: '版本',
  release_ratio: '发布比例',
  rule_id: '规则',
  source_group: '来源群',
  sender: '发送者',
};

export const CANCEL_SCOPES = ['rule', 'object'] as const;
export type CancelScope = (typeof CANCEL_SCOPES)[number];
export const CANCEL_SCOPE_LABELS: Record<CancelScope, string> = {
  rule: '本规则',
  object: '同一业务对象',
};

export const FAILURE_ACTIONS = ['pending_confirm', 'drop'] as const;
export type FailureAction = (typeof FAILURE_ACTIONS)[number];
export const FAILURE_ACTION_LABELS: Record<FailureAction, string> = {
  pending_confirm: '进入待确认',
  drop: '直接丢弃',
};

export const AUDIT_ACTIONS = [
  'rule_created',
  'rule_updated',
  'rule_published',
  'rule_rollback',
  'rule_status_changed',
  'rule_deleted',
  'simulation_run',
  'config_exported',
  'doc_downloaded',
  'connector_created',
  'connector_updated',
  'connector_deleted',
  'connector_checked',
  'connector_authorized',
  'connector_synced',
  'settings_updated',
  'task_created',
  'task_notified',
  'task_failed',
  'task_retried',
  'task_cancelled',
  'message_received',
  'task_scheduled',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  rule_created: '规则创建',
  rule_updated: '规则修改',
  rule_published: '规则发布',
  rule_rollback: '版本回滚',
  rule_status_changed: '规则启停',
  rule_deleted: '规则删除',
  simulation_run: '模拟测试',
  config_exported: '导出配置',
  doc_downloaded: '下载文档',
  connector_created: '连接器创建',
  connector_updated: '连接器更新',
  connector_deleted: '连接器删除',
  connector_checked: '配置检查',
  settings_updated: '设置更新',
  connector_authorized: '连接授权校验',
  connector_synced: '群列表同步',
  task_created: '待办创建',
  task_notified: '创建结果通知',
  task_failed: '执行失败',
  task_retried: '任务重试',
  task_cancelled: '任务取消',
  message_received: '消息接收',
  task_scheduled: '任务调度',
};

export const CONNECTOR_AUTH_STATUSES = ['unverified', 'authorized', 'invalid'] as const;
export type ConnectorAuthStatus = (typeof CONNECTOR_AUTH_STATUSES)[number];
export const CONNECTOR_AUTH_STATUS_LABELS: Record<ConnectorAuthStatus, string> = {
  unverified: '未验证',
  authorized: '已授权',
  invalid: '凭证无效',
};

export const TASK_RUN_STATUSES = [
  'pending',
  'created',
  'notify_pending',
  'failed',
  'needs_review',
  'cancelled',
] as const;
export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number];
export const isTaskRunStatus = (v: string): v is TaskRunStatus =>
  (TASK_RUN_STATUSES as readonly string[]).includes(v);
export const TASK_RUN_STATUS_LABELS: Record<TaskRunStatus, string> = {
  pending: '等待执行',
  created: '待办已创建',
  notify_pending: '待通知',
  failed: '执行失败',
  needs_review: '待人工处理',
  cancelled: '已取消',
};

/* ===== 规则配置（jsonb 存储）===== */

export interface RuleCondition {
  type: ConditionType;
  keywords?: string[];
  pattern?: string;
  senderRole?: SenderRole;
  messageType?: MessageType;
  replyDepth?: number;
}

export interface RuleConditionGroup {
  match: 'all' | 'any';
  conditions: RuleCondition[];
}

export interface ExtractionConfig {
  objectLabel?: string;
  objectPattern: string;
  versionPattern?: string;
  releaseRatioPattern?: string;
}

export interface AllowedSender {
  name: string;
  openId: string;
}

export interface DueAtConfig {
  mode: DuePolicyMode;
  delayMinutes?: number;
  fixedTime?: string;
}

export interface AssigneeStrategy {
  mode: AssignerMode;
  staticUsers?: string[];
  externalMap?: { key: string; user: string }[];
  fallback?: string;
}

export interface TimingConfig {
  mode: TimingMode;
  delayMinutes?: number;
  fixedTime?: string;
}

export interface NotifyTarget {
  type: NotifyTargetType;
  value?: string;
}

export interface RuleConfig {
  sourceConnectorId: string | null;
  sourceGroups: string[];
  action: RuleAction | null;
  sourceChatId: string;
  sourceChatName: string;
  notifyChatId: string;
  notifyChatName: string;
  allowedSenders: AllowedSender[];
  trigger: RuleConditionGroup;
  exclusions: RuleConditionGroup;
  extraction: ExtractionConfig | null;
  assignee: AssigneeStrategy | null;
  timing: TimingConfig;
  dueAt: DueAtConfig | null;
  taskTitleTemplate: string;
  taskDescTemplate: string;
  notifyTargets: NotifyTarget[];
  dedupFields: DedupField[];
  cancelWords: string[];
  cancelScope: CancelScope;
  failureAction: FailureAction;
  retryCount: number;
}

/* ===== 实体 ===== */

export interface WorkspaceSettings {
  id: string;
  name: string;
  defaultTimezone: string;
  defaultScanPeriodMinutes: number;
  pendingConfirmPolicy: string;
  securityNote: string;
  updatedAt: string;
}

export interface WorkspaceSettingsPayload {
  name: string;
  defaultTimezone: string;
  defaultScanPeriodMinutes: number;
  pendingConfirmPolicy: string;
  securityNote: string;
}

export interface DiscoveredChat {
  chatId: string;
  name: string;
}

export interface Connector {
  id: string;
  name: string;
  environment: ConnectorEnv;
  feishuAppIdMasked: string;
  secretConfigured: boolean;
  authStatus: ConnectorAuthStatus;
  executionIdentity: ExecutionIdentity;
  allowIdentityFallback: boolean;
  userAuthorized: boolean;
  userName: string;
  userTokenExpiresAt: string | null;
  sourceGroups: string[];
  notifyGroups: string[];
  discoveredChats: DiscoveredChat[];
  timezone: string;
  ownerSource: OwnerSource;
  scanPeriodMinutes: number;
  status: ConnectorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorPayload {
  name: string;
  environment: ConnectorEnv;
  feishuAppId: string;
  feishuAppSecret?: string;
  executionIdentity: ExecutionIdentity;
  allowIdentityFallback: boolean;
  sourceGroups: string[];
  notifyGroups: string[];
  timezone: string;
  ownerSource: OwnerSource;
  scanPeriodMinutes: number;
  status: ConnectorStatus;
}

export interface ConnectorOAuthUrl {
  url: string;
}

export interface ConnectorOAuthExchangePayload {
  code: string;
  redirectUri: string;
}

export interface ConnectorCheckResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
  note: string;
}

export interface ConnectorSyncResult {
  chats: DiscoveredChat[];
  note: string;
}

export interface Rule {
  id: string;
  name: string;
  code: string;
  description: string;
  type: RuleType;
  status: RuleStatus;
  currentVersion: number;
  config: RuleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface RulePayload {
  name: string;
  code: string;
  description?: string;
  type: RuleType;
  config: RuleConfig;
}

export interface RuleListQuery {
  keyword?: string;
  status?: RuleStatus;
  type?: RuleType;
}

export interface RuleVersion {
  id: string;
  ruleId: string;
  version: number;
  config: RuleConfig;
  changelog: string;
  publishedAt: string;
  publishedBy: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
}

export interface PublishResult {
  version: number;
  publishedAt: string;
  validation: ValidationResult;
}

/* ===== 模拟测试 ===== */

export interface SimulationInput {
  messageText: string;
  sender: string;
  senderRole: SenderRole;
  mentions: string[];
  sentAt: string;
  replyDepth: number;
  sourceGroup: string;
  messageId: string;
  messageType: MessageType;
}

export interface SimulationTraceStep {
  step: string;
  label: string;
  passed: boolean | null;
  detail: string;
}

export interface SimulationResult {
  matched: boolean;
  matchedConditions: string[];
  excluded: boolean;
  exclusionReason: string;
  extractedObjectKey: string;
  extractedObjectVersion: string;
  extractedReleaseRatio: string;
  assignees: string[];
  runAt: string;
  dueAt: string;
  dedupKey: string;
  notifyTargets: string[];
  taskTitle: string;
  taskDesc: string;
  cancelMatched: boolean;
  trace: SimulationTraceStep[];
}

export interface SimulationRun {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersionLabel: string;
  input: SimulationInput;
  result: SimulationResult;
  isDemo: boolean;
  createdAt: string;
  createdBy: string;
}

export interface SimulationRunRequest {
  ruleId: string;
  input: SimulationInput;
}

/* ===== 任务运行 ===== */

export interface TaskRun {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  connectionId: string;
  connectionName: string;
  messageId: string;
  status: TaskRunStatus;
  assigneeOpenId: string;
  assigneeName: string;
  objectKey: string;
  objectVersion: string;
  releaseRatio: string;
  taskTitle: string;
  taskDesc: string;
  sourceChatId: string;
  sourceChatName: string;
  notifyChatId: string;
  notifyChatName: string;
  runAt: string;
  dueAt: string | null;
  taskGuid: string;
  notifyMessageId: string;
  executionIdentity: '' | ExecutionIdentity;
  retryCount: number;
  notifyAttempts: number;
  nextRetryAt: string | null;
  lastError: string;
  dedupKey: string;
  isDemo: boolean;
  createdAt: string;
}

export interface TaskRunListQuery {
  status?: TaskRunStatus;
  ruleCode?: string;
  keyword?: string;
}

export interface TaskRunStats {
  pending: number;
  created: number;
  notify_pending: number;
  failed: number;
  needs_review: number;
  cancelled: number;
}

/* ===== 审计 ===== */

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType:
    | 'rule'
    | 'connector'
    | 'workspace'
    | 'simulation'
    | 'integration'
    | 'run'
    | 'task_run';
  entityId: string;
  entityName: string;
  summary: string;
  detail: string;
  isDemo: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AuditListQuery {
  action?: AuditAction;
  entityType?: string;
  keyword?: string;
}

/* ===== 工作台 ===== */

export interface DashboardStats {
  totalRules: number;
  publishedCount: number;
  draftCount: number;
  disabledCount: number;
  failedCount: number;
  simulations7d: number;
  simulationHits7d: number;
  simulationFailures7d: number;
  recentVersions: {
    id: string;
    ruleId: string;
    ruleName: string;
    version: number;
    changelog: string;
    publishedAt: string;
    publishedBy: string;
  }[];
  recentSimulations: {
    id: string;
    ruleName: string;
    matched: boolean;
    isDemo: boolean;
    createdAt: string;
  }[];
}

/* ===== 接入中心 ===== */

export interface PublishedRuleExport {
  code: string;
  name: string;
  type: RuleType;
  version: number;
  config: RuleConfig;
}

export interface PublishedConfigExport {
  exportedAt: string;
  workspace: string;
  rules: PublishedRuleExport[];
}

export interface IntegrationDocPayload {
  filename: string;
  markdown: string;
}

/* ===== OpenAPI 对外接入（/openapi/v1）===== */

export interface OpenapiSimulateRequest {
  ruleCode: string;
  event: SimulationInput;
}

export interface OpenapiSimulateResponse {
  ruleCode: string;
  ruleName: string;
  ruleVersion: number;
  isDemo: boolean;
  note: string;
  decision: SimulationResult;
}

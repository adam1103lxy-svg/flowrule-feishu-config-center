/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const taskRun = pgTable("task_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull(),
  ruleCode: varchar("rule_code", { length: 64 }).notNull(),
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  connectionId: uuid("connection_id").notNull(),
  messageEventId: uuid("message_event_id"),
  messageId: varchar("message_id", { length: 128 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  dedupKey: varchar("dedup_key", { length: 255 }).notNull().unique(),
  clientToken: varchar("client_token", { length: 64 }).notNull().unique(),
  assigneeOpenId: varchar("assignee_open_id", { length: 128 }).notNull(),
  assigneeName: varchar("assignee_name", { length: 100 }).notNull(),
  objectKey: varchar("object_key", { length: 200 }).notNull(),
  objectVersion: varchar("object_version", { length: 100 }).notNull(),
  releaseRatio: varchar("release_ratio", { length: 50 }).notNull(),
  taskTitle: varchar("task_title", { length: 500 }).notNull(),
  taskDesc: text("task_desc").notNull(),
  notifyChatId: varchar("notify_chat_id", { length: 128 }).notNull(),
  notifyChatName: varchar("notify_chat_name", { length: 200 }).notNull(),
  sourceChatId: varchar("source_chat_id", { length: 128 }).notNull(),
  sourceChatName: varchar("source_chat_name", { length: 200 }).notNull(),
  runAt: customTimestamptz("run_at", { precision: 3 }).notNull(),
  dueAt: customTimestamptz("due_at", { precision: 3 }),
  taskGuid: varchar("task_guid", { length: 64 }).notNull(),
  notifyMessageId: varchar("notify_message_id", { length: 128 }).notNull(),
  executionIdentity: varchar("execution_identity", { length: 16 }).notNull().default(''),
  notifyAttempts: integer("notify_attempts").notNull().default(0),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: customTimestamptz("next_retry_at", { precision: 3 }),
  lastError: text("last_error").notNull(),
  leaseOwner: varchar("lease_owner", { length: 100 }).notNull(),
  leaseExpiresAt: customTimestamptz("lease_expires_at", { precision: 3 }),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_task_run_dedup").on(table.dedupKey),
  uniqueIndex("idx_task_run_token").on(table.clientToken),
  index("idx_task_run_status_run").on(table.status, table.runAt),
]);

export const messageEvent = pgTable("message_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").notNull(),
  messageId: varchar("message_id", { length: 128 }).notNull(),
  chatId: varchar("chat_id", { length: 128 }).notNull(),
  chatName: varchar("chat_name", { length: 200 }).notNull(),
  senderOpenId: varchar("sender_open_id", { length: 128 }).notNull(),
  messageType: varchar("message_type", { length: 32 }).notNull().default('text'),
  contentText: text("content_text").notNull(),
  mentions: text("mentions").notNull().default('[]'),
  rootId: varchar("root_id", { length: 128 }).notNull(),
  replyDepth: integer("reply_depth").notNull().default(0),
  sentAt: customTimestamptz("sent_at", { precision: 3 }).notNull(),
  processed: boolean("processed").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_message_event_conn_msg").on(table.connectionId, table.messageId),
  index("idx_message_event_unprocessed").on(table.processed, table.sentAt),
]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 32 }).notNull(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: varchar("entity_id", { length: 64 }).notNull(),
  entityName: varchar("entity_name", { length: 100 }).notNull(),
  summary: text("summary").notNull(),
  detail: text("detail").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_audit_log_created").on(table.createdAt),
]);

export const simulationRun = pgTable("simulation_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull(),
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  ruleVersionLabel: varchar("rule_version_label", { length: 32 }).notNull(),
  input: text("input").notNull(),
  result: text("result").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_simulation_run_rule").on(table.ruleId),
]);

export const ruleVersion = pgTable("rule_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull(),
  version: integer("version").notNull(),
  config: text("config").notNull(),
  changelog: text("changelog").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_rule_version_rule").on(table.ruleId),
]);

export const rule = pgTable("rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 32 }).notNull().default('custom'),
  status: varchar("status", { length: 20 }).notNull().default('draft'),
  currentVersion: integer("current_version").notNull().default(0),
  config: text("config").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_rule_status").on(table.status),
]);

export const connector = pgTable("connector", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  environment: varchar("environment", { length: 20 }).notNull().default('prod'),
  feishuAppId: varchar("feishu_app_id", { length: 64 }).notNull(),
  sourceGroups: text("source_groups").array().notNull().default([]),
  notifyGroups: text("notify_groups").array().notNull().default([]),
  timezone: varchar("timezone", { length: 64 }).notNull().default('Asia/Shanghai'),
  ownerSource: varchar("owner_source", { length: 20 }).notNull().default('contact'),
  scanPeriodMinutes: integer("scan_period_minutes").notNull().default(5),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  appSecretEnc: text("app_secret_enc").notNull(),
  executionIdentity: varchar("execution_identity", { length: 16 }).notNull().default('app'),
  allowIdentityFallback: boolean("allow_identity_fallback").notNull().default(false),
  userAccessTokenEnc: text("user_access_token_enc").notNull().default(''),
  userRefreshTokenEnc: text("user_refresh_token_enc").notNull().default(''),
  userTokenExpiresAt: customTimestamptz("user_token_expires_at", { precision: 3 }),
  userRefreshExpiresAt: customTimestamptz("user_refresh_expires_at", { precision: 3 }),
  userOpenId: varchar("user_open_id", { length: 128 }).notNull().default(''),
  userName: varchar("user_name", { length: 100 }).notNull().default(''),
  authStatus: varchar("auth_status", { length: 20 }).notNull().default('unverified'),
  discoveredChats: text("discovered_chats").notNull().default('[]'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  defaultTimezone: varchar("default_timezone", { length: 64 }).notNull().default('Asia/Shanghai'),
  defaultScanPeriodMinutes: integer("default_scan_period_minutes").notNull().default(5),
  pendingConfirmPolicy: varchar("pending_confirm_policy", { length: 255 }).notNull().default('manual'),
  securityNote: text("security_note").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

// table aliases
export const auditLogTable = auditLog;
export const connectorTable = connector;
export const messageEventTable = messageEvent;
export const ruleTable = rule;
export const ruleVersionTable = ruleVersion;
export const simulationRunTable = simulationRun;
export const taskRunTable = taskRun;
export const workspaceTable = workspace;

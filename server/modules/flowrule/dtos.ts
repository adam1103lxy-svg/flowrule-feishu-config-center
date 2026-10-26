import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AUDIT_ACTIONS,
  CONNECTOR_ENVS,
  CONNECTOR_STATUSES,
  MESSAGE_TYPES,
  OWNER_SOURCES,
  RULE_STATUSES,
  RULE_TYPES,
  SENDER_ROLES,
} from '@shared/api.interface';

export class ConnectorPayloadDto {
  @IsString() @MaxLength(100)
  name!: string;

  @IsIn(CONNECTOR_ENVS)
  environment!: 'prod' | 'staging' | 'test';

  @IsString() @MaxLength(64)
  feishuAppId!: string;

  @IsString() @MaxLength(255)
  credentialRef!: string;

  @IsArray() @IsString({ each: true })
  sourceGroups!: string[];

  @IsArray() @IsString({ each: true })
  notifyGroups!: string[];

  @IsString() @MaxLength(64)
  timezone!: string;

  @IsIn(OWNER_SOURCES)
  ownerSource!: 'contact' | 'external' | 'manual';

  @Type(() => Number) @IsInt() @Min(1) @Max(1440)
  scanPeriodMinutes!: number;

  @IsIn(CONNECTOR_STATUSES)
  status!: 'active' | 'inactive';
}

export class RuleConfigPartDto {
  @IsObject()
  config!: Record<string, unknown>;
}

export class RulePayloadDto {
  @IsString() @MaxLength(100)
  name!: string;

  @IsString() @MaxLength(64)
  code!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsIn(RULE_TYPES)
  type!:
    | 'manual_assign'
    | 'account_config'
    | 'submission_review'
    | 'publish'
    | 'check_24h'
    | 'retrospective_72h'
    | 'custom';

  @IsObject()
  config!: Record<string, unknown>;
}

export class RuleUpdateDto {
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(64)
  code?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsIn(RULE_TYPES)
  type?:
    | 'manual_assign'
    | 'account_config'
    | 'submission_review'
    | 'publish'
    | 'check_24h'
    | 'retrospective_72h'
    | 'custom';

  @IsOptional() @IsObject()
  config?: Record<string, unknown>;
}

export class RuleListQueryDto {
  @IsOptional() @IsString()
  keyword?: string;

  @IsOptional() @IsIn(RULE_STATUSES)
  status?: 'draft' | 'published' | 'disabled' | 'failed';

  @IsOptional() @IsIn(RULE_TYPES)
  type?: 'manual_assign' | 'custom';
}

export class RuleStatusDto {
  @IsIn(RULE_STATUSES)
  status!: 'draft' | 'published' | 'disabled' | 'failed';
}

export class PublishDto {
  @IsOptional() @IsString() @MaxLength(500)
  changelog?: string;
}

export class RollbackDto {
  @IsString()
  versionId!: string;
}

export class SimulationInputDto {
  @IsString() @MaxLength(4000)
  messageText!: string;

  @IsString() @MaxLength(100)
  sender!: string;

  @IsIn(SENDER_ROLES)
  senderRole!: 'member' | 'admin' | 'bot' | 'any';

  @IsArray() @IsString({ each: true })
  mentions!: string[];

  @IsString()
  sentAt!: string;

  @Type(() => Number) @IsInt() @Min(0) @Max(20)
  replyDepth!: number;

  @IsString() @MaxLength(100)
  sourceGroup!: string;

  @IsString() @MaxLength(128)
  messageId!: string;

  @IsOptional() @IsIn(MESSAGE_TYPES)
  messageType?: 'text' | 'post' | 'file' | 'image' | 'any';
}

export class SimulationRunDto {
  @IsString()
  ruleId!: string;

  @IsObject()
  input!: Record<string, unknown>;
}

export class OpenapiSimulateDto {
  @IsString() @MaxLength(64)
  ruleCode!: string;

  @IsObject()
  event!: Record<string, unknown>;
}

export class AuditListQueryDto {
  @IsOptional() @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value)) @IsIn(AUDIT_ACTIONS)
  action?:
    | 'rule_created'
    | 'rule_updated'
    | 'rule_published'
    | 'rule_rollback'
    | 'rule_status_changed'
    | 'rule_deleted'
    | 'simulation_run'
    | 'config_exported'
    | 'doc_downloaded'
    | 'connector_created'
    | 'connector_updated'
    | 'connector_deleted'
    | 'connector_checked'
    | 'settings_updated';

  @IsOptional() @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value)) @IsString()
  entityType?: string;

  @IsOptional() @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value)) @IsString()
  keyword?: string;
}

export class WorkspaceSettingsDto {
  @IsString() @MaxLength(100)
  name!: string;

  @IsString() @MaxLength(64)
  defaultTimezone!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(1440)
  defaultScanPeriodMinutes!: number;

  @IsString() @MaxLength(255)
  pendingConfirmPolicy!: string;

  @IsString() @MaxLength(2000)
  securityNote!: string;
}

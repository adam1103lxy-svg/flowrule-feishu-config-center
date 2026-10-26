import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { connector } from '@server/database/schema';
import {
  CONNECTOR_ENV_LABELS,
  type Connector,
  type ConnectorCheckResult,
  type ConnectorPayload,
  type WorkspaceSettings,
} from '@shared/api.interface';
import { AuditService } from './audit.service';

const maskAppId = (appId: string): string => {
  if (appId.length <= 8) return `${appId.slice(0, 2)}****`;
  return `${appId.slice(0, 4)}****${appId.slice(-4)}`;
};

@Injectable()
export class ConnectorsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
  ) {}

  private toConnector = (row: typeof connector.$inferSelect): Connector => ({
    id: row.id,
    name: row.name,
    environment: row.environment as Connector['environment'],
    feishuAppIdMasked: maskAppId(row.feishuAppId),
    credentialRef: row.credentialRef,
    sourceGroups: row.sourceGroups,
    notifyGroups: row.notifyGroups,
    timezone: row.timezone,
    ownerSource: row.ownerSource as Connector['ownerSource'],
    scanPeriodMinutes: row.scanPeriodMinutes,
    status: row.status as Connector['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  async list(): Promise<Connector[]> {
    const rows = await this.db.select().from(connector);
    return rows.map(this.toConnector).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(payload: ConnectorPayload, userId: string): Promise<Connector> {
    if (!payload.feishuAppId.trim()) {
      throw new BadRequestException('飞书 App ID 不能为空');
    }
    const [row] = await this.db
      .insert(connector)
      .values({
        name: payload.name,
        environment: payload.environment,
        feishuAppId: payload.feishuAppId.trim(),
        credentialRef: payload.credentialRef.trim(),
        sourceGroups: payload.sourceGroups,
        notifyGroups: payload.notifyGroups,
        timezone: payload.timezone,
        ownerSource: payload.ownerSource,
        scanPeriodMinutes: payload.scanPeriodMinutes,
        status: payload.status,
      })
      .returning();
    await this.auditService.write({
      action: 'connector_created',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `创建连接器「${row.name}」（${CONNECTOR_ENV_LABELS[row.environment as Connector['environment']]}）`,
      userId,
    });
    return this.toConnector(row);
  }

  async update(id: string, payload: ConnectorPayload, userId: string): Promise<Connector> {
    const [existing] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!existing) throw new NotFoundException('连接器不存在');
    const nextAppId = payload.feishuAppId.trim().includes('*')
      ? existing.feishuAppId
      : payload.feishuAppId.trim();
    const [row] = await this.db
      .update(connector)
      .set({
        name: payload.name,
        environment: payload.environment,
        feishuAppId: nextAppId,
        credentialRef: payload.credentialRef.trim(),
        sourceGroups: payload.sourceGroups,
        notifyGroups: payload.notifyGroups,
        timezone: payload.timezone,
        ownerSource: payload.ownerSource,
        scanPeriodMinutes: payload.scanPeriodMinutes,
        status: payload.status,
        updatedAt: new Date(),
      })
      .where(eq(connector.id, id))
      .returning();
    if (!row) throw new NotFoundException('连接器不存在');
    await this.auditService.write({
      action: 'connector_updated',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `更新连接器「${row.name}」`,
      userId,
    });
    return this.toConnector(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const [row] = await this.db.delete(connector).where(eq(connector.id, id)).returning();
    if (!row) throw new NotFoundException('连接器不存在');
    await this.auditService.write({
      action: 'connector_deleted',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `删除连接器「${row.name}」`,
      userId,
    });
  }

  async check(id: string, userId: string): Promise<ConnectorCheckResult> {
    const [row] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!row) throw new NotFoundException('连接器不存在');
    const issues: string[] = [];
    const warnings: string[] = [];
    if (!row.feishuAppId.trim()) issues.push('缺少飞书 App ID');
    if (!row.credentialRef.trim())
      warnings.push('未设置凭证引用（credentialRef），请确认真实凭据已由接入方运行时的密钥体系托管')
    if (row.sourceGroups.length === 0) warnings.push('未配置来源群，规则无法绑定消息来源');
    if (row.notifyGroups.length === 0) warnings.push('未配置通知群，通知目标可能不完整');
    if (row.scanPeriodMinutes < 1) issues.push('扫描周期必须大于 0 分钟');
    if (row.status !== 'active' && issues.length === 0) {
      warnings.push('连接器处于停用状态，规则不会通过该连接器接收消息');
    }
    await this.auditService.write({
      action: 'connector_checked',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `对连接器「${row.name}」执行配置检查：${issues.length === 0 ? '通过' : '发现阻断项'}`,
      userId,
    });
    return {
      passed: issues.length === 0,
      issues,
      warnings,
      note: '配置检查仅校验配置完整性，不发起真实飞书连通性测试（本平台不接触真实凭据）。',
    };
  }

  async getTimezoneMap(): Promise<Record<string, string>> {
    const rows = await this.db.select().from(connector);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.id] = row.timezone;
    return map;
  }

  async getFallbackTimezone(workspace: WorkspaceSettings): Promise<string> {
    return workspace.defaultTimezone;
  }
}

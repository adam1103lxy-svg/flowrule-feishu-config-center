import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { connector } from '@server/database/schema';
import {
  CONNECTOR_ENV_LABELS,
  type Connector,
  type ConnectorCheckResult,
  type ConnectorPayload,
  type ConnectorOAuthUrl,
  type DiscoveredChat,
  type WorkspaceSettings,
} from '@shared/api.interface';
import { AuditService } from './audit.service';
import { FeishuClientService } from './feishu-client.service';
import { encryptSecret } from './secret-box';
import { FeishuEventsService } from './feishu-events.service';

const maskAppId = (appId: string): string => {
  if (appId.length <= 8) return `${appId.slice(0, 2)}****`;
  return `${appId.slice(0, 4)}****${appId.slice(-4)}`;
};

const toConnector = (row: typeof connector.$inferSelect): Connector => ({
  id: row.id,
  name: row.name,
  environment: row.environment as Connector['environment'],
  feishuAppIdMasked: maskAppId(row.feishuAppId),
  sourceGroups: row.sourceGroups,
  notifyGroups: row.notifyGroups,
  timezone: row.timezone,
  ownerSource: row.ownerSource as Connector['ownerSource'],
  scanPeriodMinutes: row.scanPeriodMinutes,
  status: row.status as Connector['status'],
  secretConfigured: row.appSecretEnc !== '',
  authStatus: row.authStatus as Connector['authStatus'],
  executionIdentity: row.executionIdentity as Connector['executionIdentity'],
  allowIdentityFallback: row.allowIdentityFallback,
  userAuthorized: row.userAccessTokenEnc !== '' && !!row.userTokenExpiresAt,
  userName: row.userName,
  userTokenExpiresAt: row.userTokenExpiresAt?.toISOString() ?? null,
  discoveredChats: JSON.parse(row.discoveredChats) as DiscoveredChat[],
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class ConnectorsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
    private readonly feishuClientService: FeishuClientService,
    private readonly feishuEventsService: FeishuEventsService,
  ) {}

  private async applyConnectionStatus(
    row: typeof connector.$inferSelect,
    userId: string,
    action: 'connector_created' | 'connector_updated',
  ): Promise<void> {
    if (row.status === 'active' && row.appSecretEnc !== '') {
      await this.feishuEventsService.startListener(row);
    } else {
      this.feishuEventsService.stopListener(row.id);
    }
    if (action === 'connector_created') return;
    void userId;
  }

  async list(): Promise<Connector[]> {
    const rows = await this.db.select().from(connector);
    return rows
      .map(toConnector)
      .sort((a: Connector, b: Connector) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(payload: ConnectorPayload, userId: string): Promise<Connector> {
    if (!payload.feishuAppId.trim()) {
      throw new BadRequestException('飞书 App ID 不能为空');
    }
    const appSecret = payload.feishuAppSecret?.trim() ?? '';
    const [row] = await this.db
      .insert(connector)
      .values({
        name: payload.name,
        environment: payload.environment,
        feishuAppId: payload.feishuAppId.trim(),
        appSecretEnc: appSecret !== '' ? encryptSecret(appSecret) : '',
        authStatus: 'unverified',
        executionIdentity: payload.executionIdentity,
        allowIdentityFallback: payload.allowIdentityFallback,
        discoveredChats: '[]',
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
      summary: `创建飞书连接「${row.name}」（${CONNECTOR_ENV_LABELS[row.environment as Connector['environment']]}）${appSecret !== '' ? '，App Secret 已加密存入服务端' : '，尚未配置 App Secret'}`,
      userId,
    });
    await this.applyConnectionStatus(row, userId, 'connector_created');
    return toConnector(row);
  }

  async update(id: string, payload: ConnectorPayload, userId: string): Promise<Connector> {
    const [existing] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!existing) throw new NotFoundException('连接器不存在');
    const nextAppId = payload.feishuAppId.trim().includes('*')
      ? existing.feishuAppId
      : payload.feishuAppId.trim();
    const appSecret = payload.feishuAppSecret?.trim() ?? '';
    const secretChanged = appSecret !== '';
    const appIdChanged = nextAppId !== existing.feishuAppId;
    const [row] = await this.db
      .update(connector)
      .set({
        name: payload.name,
        environment: payload.environment,
        feishuAppId: nextAppId,
        ...(secretChanged || appIdChanged
          ? {
              appSecretEnc: appSecret !== '' ? encryptSecret(appSecret) : '',
              authStatus: 'unverified',
              discoveredChats: '[]',
            }
          : {}),
        sourceGroups: payload.sourceGroups,
        executionIdentity: payload.executionIdentity,
        allowIdentityFallback: payload.allowIdentityFallback,
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
      summary: `更新飞书连接「${row.name}」${secretChanged ? '，App Secret 已更新并重新加密，需重新执行配置检查' : ''}${appIdChanged && !secretChanged ? '，App ID 变更后需重新配置 Secret' : ''}`,
      userId,
    });
    this.feishuClientService.dropClient(row.id);
    await this.applyConnectionStatus(row, userId, 'connector_updated');
    return toConnector(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const [row] = await this.db.delete(connector).where(eq(connector.id, id)).returning();
    if (!row) throw new NotFoundException('连接器不存在');
    this.feishuClientService.dropClient(row.id);
    this.feishuEventsService.stopListener(row.id);
    await this.auditService.write({
      action: 'connector_deleted',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `删除飞书连接「${row.name}」`,
      userId,
    });
  }

  async check(id: string, userId: string): Promise<ConnectorCheckResult> {
    const [row] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!row) throw new NotFoundException('连接器不存在');
    const issues: string[] = [];
    const warnings: string[] = [];
    if (!row.feishuAppId.trim()) issues.push('缺少飞书 App ID');
    if (row.appSecretEnc === '') issues.push('未配置 App Secret，无法建立真实连接');
    const credential = this.feishuClientService.resolveCredential(
      row.feishuAppId,
      row.appSecretEnc,
    );
    let authNote = '';
    let authorized = false;
    if (credential) {
      const result = await this.feishuClientService.verifyCredentials(credential);
      authorized = result.authorized;
      authNote = result.note;
      if (!result.authorized) issues.push(result.note);
    }
    if (authorized && (JSON.parse(row.discoveredChats) as DiscoveredChat[]).length === 0) {
      warnings.push('尚未拉取群列表，请点击「拉取群列表」获取机器人所在群');
    }
    if (row.sourceGroups.length === 0) warnings.push('未配置来源群，规则无法绑定消息来源');
    if (row.notifyGroups.length === 0) warnings.push('未配置通知群，通知目标可能不完整');
    if (row.scanPeriodMinutes < 1) issues.push('扫描周期必须大于 0 分钟');
    if (row.status !== 'active' && issues.length === 0) {
      warnings.push('连接处于停用状态，不会接收消息、也不会执行任务');
    }
    const nextAuthStatus = row.appSecretEnc === '' ? 'unverified' : authorized ? 'authorized' : 'invalid';
    if (nextAuthStatus !== row.authStatus) {
      await this.db
        .update(connector)
        .set({ authStatus: nextAuthStatus, updatedAt: new Date() })
        .where(eq(connector.id, id));
    }
    await this.auditService.write({
      action: 'connector_checked',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `对飞书连接「${row.name}」执行真实授权检查：${authorized ? '授权成功' : issues.length > 0 ? '发现阻断项' : '通过'}`,
      userId,
    });
    return {
      passed: issues.length === 0,
      issues,
      warnings,
      note:
        authNote !== ''
          ? authNote
          : '配置检查包含真实飞书授权验证（获取 tenant_access_token）。',
    };
  }

  async syncChats(id: string, userId: string): Promise<DiscoveredChat[]> {
    const [row] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!row) throw new NotFoundException('连接器不存在');
    const credential = this.feishuClientService.resolveCredential(
      row.feishuAppId,
      row.appSecretEnc,
    );
    if (!credential) {
      throw new BadRequestException('请先配置 App ID 与 App Secret 并完成真实授权，再拉取群列表');
    }
    const client = this.feishuClientService.getClient(row.id, credential);
    const chats = await this.feishuClientService.listChats(client);
    const [updated] = await this.db
      .update(connector)
      .set({ discoveredChats: JSON.stringify(chats), updatedAt: new Date() })
      .where(eq(connector.id, id))
      .returning();
    await this.auditService.write({
      action: 'connector_checked',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `拉取飞书连接「${row.name}」的群列表：共 ${chats.length} 个群`,
      userId,
    });
    return JSON.parse(updated.discoveredChats) as DiscoveredChat[];
  }

  async getUserOAuthUrl(
    id: string,
    redirectUri: string,
  ): Promise<ConnectorOAuthUrl> {
    const [row] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!row) throw new NotFoundException('连接器不存在');
    if (!/^https:\/\//.test(redirectUri)) {
      throw new BadRequestException('OAuth 回调地址必须使用 HTTPS');
    }
    const credential = this.feishuClientService.resolveCredential(
      row.feishuAppId,
      row.appSecretEnc,
    );
    if (!credential) throw new BadRequestException('请先配置 App ID 与 App Secret');
    return {
      url: this.feishuClientService.buildUserAuthorizeUrl(
        credential.appId,
        redirectUri,
        `flowrule:${row.id}`,
      ),
    };
  }

  async exchangeUserOAuth(
    id: string,
    code: string,
    redirectUri: string,
    userId: string,
  ): Promise<Connector> {
    const [row] = await this.db.select().from(connector).where(eq(connector.id, id));
    if (!row) throw new NotFoundException('连接器不存在');
    const credential = this.feishuClientService.resolveCredential(
      row.feishuAppId,
      row.appSecretEnc,
    );
    if (!credential) throw new BadRequestException('请先配置 App ID 与 App Secret');
    const token = await this.feishuClientService.exchangeUserCode(
      credential,
      code,
      redirectUri,
    );
    const now = Date.now();
    const [updated] = await this.db
      .update(connector)
      .set({
        userAccessTokenEnc: encryptSecret(token.accessToken),
        userRefreshTokenEnc: token.refreshToken ? encryptSecret(token.refreshToken) : '',
        userTokenExpiresAt: new Date(now + Math.max(60, token.expiresIn - 60) * 1000),
        userRefreshExpiresAt: token.refreshExpiresIn
          ? new Date(now + token.refreshExpiresIn * 1000)
          : null,
        userOpenId: token.openId,
        userName: token.name || '已授权用户',
        updatedAt: new Date(),
      })
      .where(eq(connector.id, id))
      .returning();
    await this.auditService.write({
      action: 'connector_authorized',
      entityType: 'connector',
      entityId: row.id,
      entityName: row.name,
      summary: `用户身份授权成功：${token.name || token.openId || '已授权用户'}；令牌已加密保存且不回显`,
      userId,
    });
    return toConnector(updated);
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

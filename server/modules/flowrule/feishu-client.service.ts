import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  AppType,
  Client as LarkClient,
  Domain,
  LoggerLevel,
} from '@larksuiteoapi/node-sdk';
import { decryptSecret } from './secret-box';

const TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
const OAUTH_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';
const OPEN_API = 'https://open.feishu.cn/open-apis';

export interface FeishuCredential {
  appId: string;
  appSecret: string;
}

export interface CreatedTask {
  guid: string;
  url: string;
}

export interface VerifiedTask {
  guid: string;
  url: string;
  summary: string;
  assigneeOpenIds: string[];
}

export interface DiscoveredChatInfo {
  chatId: string;
  name: string;
}

export interface CredentialCheckResult {
  authorized: boolean;
  note: string;
}

export interface UserOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  openId: string;
  name: string;
}

interface UserInfoResponse {
  open_id?: string;
  name?: string;
}

interface TaskV2Member {
  id?: string;
  role?: string;
  type?: string;
}

interface TaskV2Task {
  guid?: string;
  url?: string;
  summary?: string;
  members?: TaskV2Member[];
}

const toMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

@Injectable()
export class FeishuClientService {
  private readonly logger = new Logger(FeishuClientService.name);
  private readonly clients = new Map<string, LarkClient>();

  getClient(connectionId: string, credential: FeishuCredential): LarkClient {
    const cached = this.clients.get(connectionId);
    if (cached) return cached;
    const client = new LarkClient({
      appId: credential.appId,
      appSecret: credential.appSecret,
      appType: AppType.SelfBuild,
      domain: Domain.Feishu,
      loggerLevel: LoggerLevel.warn,
    });
    this.clients.set(connectionId, client);
    return client;
  }

  dropClient(connectionId: string): void {
    this.clients.delete(connectionId);
  }

  resolveCredential(
    appId: string,
    appSecretEnc: string,
  ): FeishuCredential | null {
    if (!appId || !appSecretEnc) return null;
    try {
      return { appId, appSecret: decryptSecret(appSecretEnc) };
    } catch (error) {
      this.logger.error(`解密连接凭证失败: ${toMessage(error)}`);
      return null;
    }
  }

  resolveEncryptedValue(value: string): string {
    return value ? decryptSecret(value) : '';
  }

  async verifyCredentials(
    credential: FeishuCredential,
  ): Promise<CredentialCheckResult> {
    try {
      const resp = await axios.post(
        TOKEN_URL,
        {
          app_id: credential.appId,
          app_secret: credential.appSecret,
        },
        { timeout: 10_000 },
      );
      const data = resp.data as { code?: number; msg?: string; app_name?: string };
      if (data.code === 0) {
        return {
          authorized: true,
          note: `真实授权成功：已获取 tenant_access_token（应用「${data.app_name ?? credential.appId}」），可接收消息、创建待办并发送通知`,
        };
      }
      return {
        authorized: false,
        note: `飞书授权失败：${data.msg ?? '未知错误'}`,
      };
    } catch (error) {
      return {
        authorized: false,
        note: `无法连接飞书开放平台：${toMessage(error)}`,
      };
    }
  }

  buildUserAuthorizeUrl(appId: string, redirectUri: string, state: string): string {
    const query = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      scope: 'task:task:read task:task:write im:message offline_access',
      state,
    });
    return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${query.toString()}`;
  }

  async exchangeUserCode(
    credential: FeishuCredential,
    code: string,
    redirectUri: string,
  ): Promise<UserOAuthToken> {
    const resp = await axios.post(
      OAUTH_TOKEN_URL,
      {
        grant_type: 'authorization_code',
        client_id: credential.appId,
        client_secret: credential.appSecret,
        code,
        redirect_uri: redirectUri,
      },
      { timeout: 10_000 },
    );
    const data = resp.data as Record<string, unknown>;
    if (data.code !== 0 || typeof data.access_token !== 'string') {
      throw new Error(`用户身份授权失败 code=${String(data.code)} msg=${String(data.error_description ?? data.msg ?? '未知错误')}`);
    }
    const token = {
      accessToken: data.access_token,
      refreshToken: String(data.refresh_token ?? ''),
      expiresIn: Number(data.expires_in ?? 0),
      refreshExpiresIn: Number(data.refresh_token_expires_in ?? 0),
      openId: String(data.open_id ?? ''),
      name: String(data.name ?? ''),
    };
    return this.enrichUserToken(token);
  }

  async refreshUserToken(
    credential: FeishuCredential,
    refreshToken: string,
  ): Promise<UserOAuthToken> {
    const resp = await axios.post(
      OAUTH_TOKEN_URL,
      {
        grant_type: 'refresh_token',
        client_id: credential.appId,
        client_secret: credential.appSecret,
        refresh_token: refreshToken,
      },
      { timeout: 10_000 },
    );
    const data = resp.data as Record<string, unknown>;
    if (data.code !== 0 || typeof data.access_token !== 'string') {
      throw new Error(`用户身份刷新失败 code=${String(data.code)} msg=${String(data.error_description ?? data.msg ?? '未知错误')}`);
    }
    const token = {
      accessToken: data.access_token,
      refreshToken: String(data.refresh_token ?? refreshToken),
      expiresIn: Number(data.expires_in ?? 0),
      refreshExpiresIn: Number(data.refresh_token_expires_in ?? 0),
      openId: String(data.open_id ?? ''),
      name: String(data.name ?? ''),
    };
    return this.enrichUserToken(token);
  }

  private async enrichUserToken(token: UserOAuthToken): Promise<UserOAuthToken> {
    if (token.openId && token.name) return token;
    try {
      const resp = await axios.get(`${OPEN_API}/authen/v1/user_info`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        timeout: 10_000,
      });
      const body = resp.data as { code?: number; data?: UserInfoResponse } & UserInfoResponse;
      const info = body.data ?? body;
      return {
        ...token,
        openId: token.openId || info.open_id || '',
        name: token.name || info.name || '',
      };
    } catch (error) {
      this.logger.warn(`用户身份信息读取失败，保留 token 返回字段: ${toMessage(error)}`);
      return token;
    }
  }

  async createTaskAsUser(
    accessToken: string,
    options: {
      summary: string;
      description: string;
      assigneeOpenId: string;
      dueAt: Date | null;
      clientToken: string;
    },
  ): Promise<CreatedTask> {
    const task: Record<string, unknown> = {
      summary: options.summary,
      description: options.description,
      members: [{ id: options.assigneeOpenId, type: 'user', role: 'assignee' }],
    };
    if (options.dueAt) {
      task.due = {
        timestamp: String(Math.floor(options.dueAt.getTime() / 1000)),
        is_all_day: false,
      };
    }
    const resp = await axios.post(
      `${OPEN_API}/task/v2/tasks`,
      task,
      {
        params: { user_id_type: 'open_id', client_token: options.clientToken },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10_000,
      },
    );
    const body = resp.data as { code?: number; msg?: string; data?: { task?: TaskV2Task } };
    if (body.code !== 0 || !body.data?.task?.guid) {
      throw new Error(`用户身份 Task v2 创建失败 code=${body.code} msg=${body.msg}`);
    }
    return { guid: body.data.task.guid, url: body.data.task.url ?? '' };
  }

  async getTaskAsUser(accessToken: string, guid: string): Promise<VerifiedTask> {
    const resp = await axios.get(`${OPEN_API}/task/v2/tasks/${encodeURIComponent(guid)}`, {
      params: { user_id_type: 'open_id' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10_000,
    });
    const body = resp.data as { code?: number; msg?: string; data?: { task?: TaskV2Task } };
    const task = body.data?.task;
    if (body.code !== 0 || !task) {
      throw new Error(`用户身份 Task v2 回读失败 code=${body.code} msg=${body.msg}`);
    }
    return {
      guid: task.guid ?? guid,
      url: task.url ?? '',
      summary: task.summary ?? '',
      assigneeOpenIds: (task.members ?? [])
        .filter((member) => member.role === 'assignee')
        .map((member) => member.id ?? '')
        .filter(Boolean),
    };
  }

  async sendTextMessageAsUser(
    accessToken: string,
    chatId: string,
    text: string,
  ): Promise<string> {
    const resp = await axios.post(
      `${OPEN_API}/im/v1/messages`,
      {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
      {
        params: { receive_id_type: 'chat_id' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10_000,
      },
    );
    const body = resp.data as { code?: number; msg?: string; data?: { message_id?: string } };
    if (body.code !== 0 || !body.data?.message_id) {
      throw new Error(`用户身份消息发送失败 code=${body.code} msg=${body.msg}`);
    }
    return body.data.message_id;
  }

  async createTask(
    client: LarkClient,
    options: {
      summary: string;
      description: string;
      assigneeOpenId: string;
      dueAt: Date | null;
      clientToken: string;
    },
  ): Promise<CreatedTask> {
    const data: {
      summary: string;
      description: string;
      members: { id: string; type: 'user'; role: 'assignee' }[];
      due?: { timestamp: string; is_all_day: boolean };
    } = {
      summary: options.summary,
      description: options.description,
      members: [
        { id: options.assigneeOpenId, type: 'user', role: 'assignee' },
      ],
    };
    if (options.dueAt) {
      data.due = {
        timestamp: String(Math.floor(options.dueAt.getTime() / 1000)),
        is_all_day: false,
      };
    }
    const resp = await client.task.v2.task.create({
      params: {
        user_id_type: 'open_id',
        client_token: options.clientToken,
      } as { user_id_type: string },
      data,
    });
    if (resp.code !== 0) {
      throw new Error(`Task v2 创建失败 code=${resp.code} msg=${resp.msg}`);
    }
    const task = (resp.data as { task?: TaskV2Task } | undefined)?.task;
    if (!task?.guid) {
      throw new Error('Task v2 创建成功但未返回 task guid');
    }
    return { guid: task.guid, url: task.url ?? '' };
  }

  async getTask(client: LarkClient, guid: string): Promise<VerifiedTask> {
    const resp = await client.task.v2.task.get({
      path: { task_guid: guid },
      params: { user_id_type: 'open_id' },
    });
    if (resp.code !== 0) {
      throw new Error(`Task v2 回读失败 code=${resp.code} msg=${resp.msg}`);
    }
    const task = (resp.data as { task?: TaskV2Task } | undefined)?.task;
    if (!task) throw new Error('Task v2 回读成功但未返回任务主体');
    return {
      guid: task.guid ?? guid,
      url: task.url ?? '',
      summary: task.summary ?? '',
      assigneeOpenIds: (task.members ?? [])
        .filter((m: TaskV2Member) => m.role === 'assignee')
        .map((m: TaskV2Member) => m.id ?? '')
        .filter((id: string) => id !== ''),
    };
  }

  async sendTextMessage(
    client: LarkClient,
    chatId: string,
    text: string,
  ): Promise<string> {
    const resp = await client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
    if (resp.code !== 0) {
      throw new Error(`飞书消息发送失败 code=${resp.code} msg=${resp.msg}`);
    }
    const messageId = (resp.data as { message_id?: string } | undefined)
      ?.message_id;
    if (!messageId) throw new Error('消息发送成功但未返回 message_id');
    return messageId;
  }

  async listChats(client: LarkClient): Promise<DiscoveredChatInfo[]> {
    const chats: DiscoveredChatInfo[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const resp = await client.im.v1.chat.list({
        params: { page_size: 100, page_token: pageToken },
      });
      if (resp.code !== 0) {
        throw new Error(`群列表拉取失败 code=${resp.code} msg=${resp.msg}`);
      }
      const data = resp.data as {
        items?: { chat_id?: string; name?: string }[];
        has_more?: boolean;
        page_token?: string;
      };
      for (const item of data.items ?? []) {
        if (item.chat_id) {
          chats.push({ chatId: item.chat_id, name: item.name ?? item.chat_id });
        }
      }
      if (!data.has_more || !data.page_token) break;
      pageToken = data.page_token;
    }
    return chats;
  }
}

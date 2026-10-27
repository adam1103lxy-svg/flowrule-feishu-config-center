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
      },
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

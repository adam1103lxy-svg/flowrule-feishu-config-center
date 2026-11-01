import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { connector } from '@server/database/schema';
import {
  EventDispatcher,
  LoggerLevel,
  WSClient,
} from '@larksuiteoapi/node-sdk';
import { FeishuClientService } from './feishu-client.service';
import { DispatcherService } from './dispatcher.service';

@Injectable()
export class FeishuEventsService implements OnModuleInit {
  private readonly logger = new Logger(FeishuEventsService.name);
  private readonly wsClients = new Map<string, WSClient>();

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly feishuClientService: FeishuClientService,
    private readonly dispatcherService: DispatcherService,
  ) {}

  onModuleInit(): void {
    void this.reloadActiveConnections();
  }

  async reloadActiveConnections(): Promise<void> {
    try {
      const rows = await this.db
        .select()
        .from(connector)
        .where(eq(connector.status, 'active'));
      for (const row of rows) {
        await this.startListener(row);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`启动时恢复飞书监听失败: ${message}`);
    }
  }

  async startListener(row: typeof connector.$inferSelect): Promise<void> {
    if (row.status !== 'active' || row.appSecretEnc === '') {
      this.stopListener(row.id);
      return;
    }
    if (this.wsClients.has(row.id)) return;
    const credential = this.feishuClientService.resolveCredential(
      row.feishuAppId,
      row.appSecretEnc,
    );
    if (!credential) return;
    const eventDispatcher = new EventDispatcher({}).register({
      'im.message.receive_v1': async (data: unknown) => {
        await this.dispatcherService.handleIncoming(row.id, data as never);
      },
    });
    const ws = new WSClient({
      appId: credential.appId,
      appSecret: credential.appSecret,
      loggerLevel: LoggerLevel.warn,
    });
    this.wsClients.set(row.id, ws);
    try {
      await ws.start({ eventDispatcher });
      this.logger.log(`飞书连接「${row.name}」(${row.id}) 实时消息监听已启动`);
    } catch (error) {
      this.wsClients.delete(row.id);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `飞书连接「${row.name}」(${row.id}) 消息监听启动失败: ${message}`,
      );
    }
  }

  stopListener(connectionId: string): void {
    const ws = this.wsClients.get(connectionId);
    if (!ws) return;
    try {
      ws.close({ force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`关闭飞书监听 ${connectionId} 时出错: ${message}`);
    }
    this.wsClients.delete(connectionId);
  }
}

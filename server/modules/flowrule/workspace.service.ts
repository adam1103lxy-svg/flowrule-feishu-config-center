import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { workspace } from '@server/database/schema';
import type { WorkspaceSettings, WorkspaceSettingsPayload } from '@shared/api.interface';
import { AuditService } from './audit.service';

const toSettings = (row: typeof workspace.$inferSelect): WorkspaceSettings => ({
  id: row.id,
  name: row.name,
  defaultTimezone: row.defaultTimezone,
  defaultScanPeriodMinutes: row.defaultScanPeriodMinutes,
  pendingConfirmPolicy: row.pendingConfirmPolicy,
  securityNote: row.securityNote,
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
  ) {}

  async get(): Promise<WorkspaceSettings> {
    const [row] = await this.db.select().from(workspace);
    if (!row) throw new NotFoundException('工作区不存在');
    return toSettings(row);
  }

  async update(payload: WorkspaceSettingsPayload, userId: string): Promise<WorkspaceSettings> {
    const existing = await this.get();
    const [row] = await this.db
      .update(workspace)
      .set({
        name: payload.name,
        defaultTimezone: payload.defaultTimezone,
        defaultScanPeriodMinutes: payload.defaultScanPeriodMinutes,
        pendingConfirmPolicy: payload.pendingConfirmPolicy,
        securityNote: payload.securityNote,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, existing.id))
      .returning();
    if (!row) throw new NotFoundException('工作区不存在');
    await this.auditService.write({
      action: 'settings_updated',
      entityType: 'workspace',
      entityId: row.id,
      entityName: row.name,
      summary: `更新工作区设置「${row.name}」`,
      userId,
    });
    return toSettings(row);
  }
}

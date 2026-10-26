import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { auditLog } from '@server/database/schema';
import type { AuditAction, AuditLogEntry, AuditListQuery } from '@shared/api.interface';
import { and, ilike, or, type SQL } from 'drizzle-orm';

interface AuditWriteParams {
  action: AuditAction;
  entityType: AuditLogEntry['entityType'];
  entityId: string;
  entityName: string;
  summary: string;
  detail?: string;
  isDemo?: boolean;
  userId?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async write(params: AuditWriteParams): Promise<void> {
    await this.db.insert(auditLog).values({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      summary: params.summary,
      detail: params.detail ?? '',
      isDemo: params.isDemo ?? false,
    });
  }

  async list(query: AuditListQuery): Promise<AuditLogEntry[]> {
    const conditions: SQL[] = [];
    if (query.action) conditions.push(eq(auditLog.action, query.action));
    if (query.entityType) conditions.push(eq(auditLog.entityType, query.entityType));
    if (query.keyword) {
      const like = `%${query.keyword}%`;
      const kw = or(
        ilike(auditLog.entityName, like),
        ilike(auditLog.summary, like),
      );
      if (kw) conditions.push(kw);
    }
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
    return rows.map((row) => ({
      id: row.id,
      action: row.action as AuditAction,
      entityType: row.entityType as AuditLogEntry['entityType'],
      entityId: row.entityId,
      entityName: row.entityName,
      summary: row.summary,
      detail: row.detail,
      isDemo: row.isDemo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy ?? '',
    }));
  }
}

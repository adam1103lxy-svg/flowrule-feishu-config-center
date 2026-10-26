import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { rule, ruleVersion } from '@server/database/schema';
import type {
  PublishResult,
  Rule,
  RuleListQuery,
  RuleStatus,
  RuleVersion,
  ValidationResult,
} from '@shared/api.interface';
import { normalizeRuleConfig, validateRuleConfig } from './engine';
import { AuditService } from './audit.service';
import { extractPostgresErrorCode } from './pg-error';

const toRule = (row: typeof rule.$inferSelect): Rule => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  type: row.type as Rule['type'],
  status: row.status as RuleStatus,
  currentVersion: row.currentVersion,
  config: normalizeRuleConfig(JSON.parse(row.config)),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toVersion = (row: typeof ruleVersion.$inferSelect): RuleVersion => ({
  id: row.id,
  ruleId: row.ruleId,
  version: row.version,
  config: normalizeRuleConfig(JSON.parse(row.config)),
  changelog: row.changelog,
  publishedAt: row.createdAt.toISOString(),
  publishedBy: row.createdBy ?? '',
});

export interface RuleWriteInput {
  name: string;
  code: string;
  description?: string;
  type: Rule['type'];
  config: unknown;
}

@Injectable()
export class RulesService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
  ) {}

  async list(query: RuleListQuery): Promise<Rule[]> {
    const conditions: SQL[] = [];
    if (query.keyword) {
      const like = `%${query.keyword}%`;
      const kw = or(ilike(rule.name, like), ilike(rule.code, like));
      if (kw) conditions.push(kw);
    }
    if (query.status) conditions.push(eq(rule.status, query.status));
    if (query.type) conditions.push(eq(rule.type, query.type));
    const rows = await this.db
      .select()
      .from(rule)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rule.updatedAt));
    return rows.map(toRule);
  }

  async get(id: string): Promise<Rule> {
    const [row] = await this.db.select().from(rule).where(eq(rule.id, id));
    if (!row) throw new NotFoundException('规则不存在');
    return toRule(row);
  }

  async create(payload: RuleWriteInput, userId: string): Promise<Rule> {
    if (!payload.code.trim()) throw new BadRequestException('规则标识不能为空');
    try {
      const [row] = await this.db
        .insert(rule)
        .values({
          name: payload.name,
          code: payload.code.trim(),
          description: payload.description ?? '',
          type: payload.type,
          status: 'draft',
          currentVersion: 0,
          config: JSON.stringify(payload.config),
        })
        .returning();
      await this.auditService.write({
        action: 'rule_created',
        entityType: 'rule',
        entityId: row.id,
        entityName: row.name,
        summary: `创建规则「${row.name}」（${row.code}）`,
        userId,
      });
      return toRule(row);
    } catch (error) {
      if (extractPostgresErrorCode(error) === '23505') {
        throw new BadRequestException(`规则标识 ${payload.code} 已存在`);
      }
      throw error;
    }
  }

  async update(
    id: string,
    payload: {
      name?: string;
      code?: string;
      description?: string;
      type?: Rule['type'];
      config?: unknown;
    },
    userId: string,
  ): Promise<Rule> {
    const existing = await this.get(id);
    const patch: Partial<typeof rule.$inferInsert> = { updatedAt: new Date() };
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.type !== undefined) patch.type = payload.type;
    if (payload.code !== undefined) {
      if (!payload.code.trim()) throw new BadRequestException('规则标识不能为空');
      patch.code = payload.code.trim();
    }
    if (payload.config !== undefined) patch.config = JSON.stringify(payload.config);
    const [row] = await this.db
      .update(rule)
      .set(patch)
      .where(eq(rule.id, id))
      .returning();
    if (!row) throw new NotFoundException('规则不存在');
    await this.auditService.write({
      action: 'rule_updated',
      entityType: 'rule',
      entityId: row.id,
      entityName: row.name,
      summary: `修改规则「${row.name}」${existing.status === 'published' ? '（已发布规则的修改需重新发布生效）' : ''}`,
      userId,
    });
    return toRule(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const [row] = await this.db.delete(rule).where(eq(rule.id, id)).returning();
    if (!row) throw new NotFoundException('规则不存在');
    await this.db.delete(ruleVersion).where(eq(ruleVersion.ruleId, id));
    await this.auditService.write({
      action: 'rule_deleted',
      entityType: 'rule',
      entityId: row.id,
      entityName: row.name,
      summary: `删除规则「${row.name}」（${row.code}）及其版本历史`,
      userId,
    });
  }

  async duplicate(id: string, userId: string): Promise<Rule> {
    const source = await this.get(id);
    let code = `${source.code}_copy`;
    const clash = await this.db.select().from(rule).where(eq(rule.code, code));
    if (clash.length > 0) code = `${code}_${Date.now().toString().slice(-4)}`;
    const [row] = await this.db
      .insert(rule)
      .values({
        name: `${source.name}（副本）`,
        code,
        description: source.description,
        type: source.type,
        status: 'draft',
        currentVersion: 0,
        config: JSON.stringify(source.config),
      })
      .returning();
    await this.auditService.write({
      action: 'rule_created',
      entityType: 'rule',
      entityId: row.id,
      entityName: row.name,
      summary: `复制规则「${source.name}」为草稿「${row.name}」`,
      userId,
    });
    return toRule(row);
  }

  async setStatus(id: string, status: RuleStatus, userId: string): Promise<Rule> {
    const existing = await this.get(id);
    if (!['published', 'disabled', 'draft'].includes(status)) {
      throw new BadRequestException('不支持的规则状态');
    }
    if (status === 'published' && existing.currentVersion === 0) {
      throw new BadRequestException('草稿规则需先发布版本后才能启用');
    }
    const [row] = await this.db
      .update(rule)
      .set({ status, updatedAt: new Date() })
      .where(eq(rule.id, id))
      .returning();
    if (!row) throw new NotFoundException('规则不存在');
    await this.auditService.write({
      action: 'rule_status_changed',
      entityType: 'rule',
      entityId: row.id,
      entityName: row.name,
      summary:
        status === 'disabled'
          ? `停用规则「${row.name}」`
          : `启用规则「${row.name}」（当前版本 v${row.currentVersion}）`,
      userId,
    });
    return toRule(row);
  }

  async versions(ruleId: string): Promise<RuleVersion[]> {
    await this.get(ruleId);
    const rows = await this.db
      .select()
      .from(ruleVersion)
      .where(eq(ruleVersion.ruleId, ruleId))
      .orderBy(desc(ruleVersion.version));
    return rows.map(toVersion);
  }

  async validate(id: string): Promise<ValidationResult> {
    const target = await this.get(id);
    return validateRuleConfig(target.config);
  }

  async publish(id: string, changelog: string, userId: string): Promise<PublishResult> {
    const target = await this.get(id);
    const validation = validateRuleConfig(target.config);
    if (!validation.passed) {
      await this.db
        .update(rule)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(rule.id, id));
      await this.auditService.write({
        action: 'rule_published',
        entityType: 'rule',
        entityId: target.id,
        entityName: target.name,
        summary: `规则「${target.name}」发布校验未通过：${validation.issues.join('；')}`,
        userId,
      });
      throw new BadRequestException(
        `发布校验未通过：${validation.issues.join('；')}`,
      );
    }
    const nextVersion = target.currentVersion + 1;
    const [versionRow] = await this.db
      .insert(ruleVersion)
      .values({
        ruleId: id,
        version: nextVersion,
        config: JSON.stringify(target.config),
        changelog: changelog || `发布 v${nextVersion}`,
      })
      .returning();
    const [row] = await this.db
      .update(rule)
      .set({ status: 'published', currentVersion: nextVersion, updatedAt: new Date() })
      .where(eq(rule.id, id))
      .returning();
    if (!row) throw new NotFoundException('规则不存在');
    await this.auditService.write({
      action: 'rule_published',
      entityType: 'rule',
      entityId: id,
      entityName: target.name,
      summary: `规则「${target.name}」发布新版本 v${nextVersion}`,
      detail: changelog || '',
      userId,
    });
    return {
      version: nextVersion,
      publishedAt: versionRow.createdAt.toISOString(),
      validation,
    };
  }

  async rollback(id: string, versionId: string, userId: string): Promise<Rule> {
    const target = await this.get(id);
    const [versionRow] = await this.db
      .select()
      .from(ruleVersion)
      .where(and(eq(ruleVersion.id, versionId), eq(ruleVersion.ruleId, id)));
    if (!versionRow) throw new NotFoundException('目标版本不存在');
    const [row] = await this.db
      .update(rule)
      .set({
        config: versionRow.config,
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(rule.id, id))
      .returning();
    if (!row) throw new NotFoundException('规则不存在');
    await this.auditService.write({
      action: 'rule_rollback',
      entityType: 'rule',
      entityId: id,
      entityName: target.name,
      summary: `规则「${target.name}」将 v${versionRow.version} 回滚为新草稿`,
      userId,
    });
    return toRule(row);
  }

  async publishedRules(): Promise<Rule[]> {
    const rows = await this.db
      .select()
      .from(rule)
      .where(eq(rule.status, 'published'));
    return rows.map(toRule);
  }
}

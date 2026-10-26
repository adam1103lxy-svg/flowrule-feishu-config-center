import { Controller, Get } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { count, desc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { rule, ruleVersion } from '@server/database/schema';
import type { DashboardStats } from '@shared/api.interface';
import { SimulationService } from './simulation.service';
import { SeedService } from './seed.service';

@Controller('api/dashboard')
@NeedLogin()
export class DashboardController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly simulationService: SimulationService,
    private readonly seedService: SeedService,
  ) {}

  @Get('stats')
  async stats(): Promise<DashboardStats> {
    await this.seedService.ensureSeeded();
    const statusRows = await this.db
      .select({ status: rule.status, total: count() })
      .from(rule)
      .groupBy(rule.status);
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of statusRows) {
      byStatus[row.status] = row.total;
      total += row.total;
    }
    const simStats = await this.simulationService.statsForDashboard();
    const versionRows = await this.db
      .select({
        id: ruleVersion.id,
        ruleId: ruleVersion.ruleId,
        version: ruleVersion.version,
        changelog: ruleVersion.changelog,
        publishedAt: ruleVersion.createdAt,
        publishedBy: ruleVersion.createdBy,
        ruleName: rule.name,
      })
      .from(ruleVersion)
      .innerJoin(rule, eq(rule.id, ruleVersion.ruleId))
      .orderBy(desc(ruleVersion.createdAt))
      .limit(5);
    return {
      totalRules: total,
      publishedCount: byStatus.published ?? 0,
      draftCount: byStatus.draft ?? 0,
      disabledCount: byStatus.disabled ?? 0,
      failedCount: byStatus.failed ?? 0,
      simulations7d: simStats.simulations7d,
      simulationHits7d: simStats.simulationHits7d,
      simulationFailures7d: simStats.simulationFailures7d,
      recentVersions: versionRows.map((row) => ({
        id: row.id,
        ruleId: row.ruleId,
        ruleName: row.ruleName,
        version: row.version,
        changelog: row.changelog,
        publishedAt: row.publishedAt.toISOString(),
        publishedBy: row.publishedBy ?? '',
      })),
      recentSimulations: simStats.recent,
    };
  }
}

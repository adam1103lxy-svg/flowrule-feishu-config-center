import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import type { Response } from 'express';
import { RulesService } from './rules.service';
import { AuditService } from './audit.service';
import { WorkspaceService } from './workspace.service';
import { SeedService } from './seed.service';
import { IntegrationService } from './integration.service';

@Controller('api/integration')
@NeedLogin()
export class IntegrationController {
  constructor(
    private readonly rulesService: RulesService,
    private readonly workspaceService: WorkspaceService,
    private readonly integrationService: IntegrationService,
    private readonly auditService: AuditService,
    private readonly seedService: SeedService,
  ) {}

  @Get('config')
  async config() {
    await this.seedService.ensureSeeded();
    const workspace = await this.workspaceService.get();
    const rules = await this.rulesService.publishedRules();
    return this.integrationService.buildExport(workspace.name, rules);
  }

  @Get('export')
  async export(@Req() req: Request, @Res() res: Response) {
    await this.seedService.ensureSeeded();
    const workspace = await this.workspaceService.get();
    const rules = await this.rulesService.publishedRules();
    const payload = this.integrationService.buildExport(workspace.name, rules);
    await this.auditService.write({
      action: 'config_exported',
      entityType: 'integration',
      entityId: 'export',
      entityName: '发布配置导出',
      summary: `导出当前发布配置（${payload.rules.length} 条已发布规则）`,
      userId: req.userContext.userId,
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="flowrule-published-config.json"',
    );
    res.send(JSON.stringify(payload, null, 2));
  }

  @Get('doc')
  async doc(@Req() req: Request, @Query('preview') preview: string | undefined, @Res() res: Response) {
    await this.seedService.ensureSeeded();
    const markdown = this.integrationService.buildDoc();
    if (preview === '1') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(markdown);
      return;
    }
    await this.auditService.write({
      action: 'doc_downloaded',
      entityType: 'integration',
      entityId: 'doc',
      entityName: '接入文档',
      summary: '下载接入文档 flowrule-integration-guide.md',
      userId: req.userContext.userId,
    });
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="flowrule-integration-guide.md"',
    );
    res.send(markdown);
  }
}

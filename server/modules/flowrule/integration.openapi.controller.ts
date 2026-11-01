import { Body, Controller, Get, Post } from '@nestjs/common';
import { RulesService } from './rules.service';
import { WorkspaceService } from './workspace.service';
import { SeedService } from './seed.service';
import { IntegrationService } from './integration.service';
import { SimulationService } from './simulation.service';
import { OpenapiSimulateDto } from './dtos';
import { PUBLISHED_CONFIG_JSON_SCHEMA } from './integration-schema';

@Controller('openapi/v1')
export class IntegrationOpenApiController {
  constructor(
    private readonly rulesService: RulesService,
    private readonly workspaceService: WorkspaceService,
    private readonly integrationService: IntegrationService,
    private readonly simulationService: SimulationService,
    private readonly seedService: SeedService,
  ) {}

  @Get('published-config')
  async getPublishedConfig() {
    await this.seedService.ensureSeeded();
    const workspace = await this.workspaceService.get();
    const rules = await this.rulesService.publishedRules();
    return this.integrationService.buildExport(workspace.name, rules);
  }

  @Get('schema')
  getSchema() {
    return PUBLISHED_CONFIG_JSON_SCHEMA;
  }

  @Post('simulate')
  async simulate(@Body() dto: OpenapiSimulateDto) {
    return this.simulationService.runByCode(dto.ruleCode, dto.event);
  }
}

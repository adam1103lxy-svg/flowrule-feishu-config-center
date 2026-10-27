import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { DashboardController } from './dashboard.controller';
import { IntegrationController } from './integration.controller';
import { IntegrationOpenApiController } from './integration.openapi.controller';
import { IntegrationService } from './integration.service';
import { SeedService } from './seed.service';
import { RunsController } from './runs.controller';
import { TaskRunService } from './task-run.service';
import { FeishuClientService } from './feishu-client.service';
import { FeishuEventsService } from './feishu-events.service';
import { DispatcherService } from './dispatcher.service';
import { FlowRuleAutomationTasksService } from './flowrule.automation';

@Module({
  imports: [],
  controllers: [
    ConnectorsController,
    RulesController,
    RunsController,
    SimulationController,
    AuditController,
    WorkspaceController,
    DashboardController,
    IntegrationController,
    IntegrationOpenApiController,
  ],
  providers: [
    ConnectorsService,
    RulesService,
    SimulationService,
    AuditService,
    WorkspaceService,
    IntegrationService,
    SeedService,
    FeishuClientService,
    FeishuEventsService,
    DispatcherService,
    TaskRunService,
    FlowRuleAutomationTasksService,
  ],
})
export class FlowRuleModule {}

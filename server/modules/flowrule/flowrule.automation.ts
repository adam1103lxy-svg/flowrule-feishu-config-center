import { Logger } from '@nestjs/common';
import { Automation, BindTrigger } from '@lark-apaas/nestjs-trigger';
import { DispatcherService } from './dispatcher.service';
import { TaskRunService } from './task-run.service';

/**
 * FlowRule 运行底座自动化任务：
 * - flowrule_runtime_tick：周期驱动（由平台 cron 触发器调度，最小 30 分钟）
 * - flowrule_catchup_tick：补漏入口（处理 processed=false 的历史消息事件）
 *
 * 两类任务都只做有界批量处理，任何单条失败不影响其余记录。
 */
@Automation()
export class FlowRuleAutomationTasksService {
  private readonly logger = new Logger(FlowRuleAutomationTasksService.name);

  constructor(
    private readonly taskRunService: TaskRunService,
    private readonly dispatcherService: DispatcherService,
  ) {}

  @BindTrigger('flowrule_runtime_tick')
  async runtimeTick(): Promise<void> {
    this.logger.log('运行底座心跳：开始处理到期任务');
    const processed = await this.taskRunService.processDue(20);
    const caughtUp = await this.dispatcherService.processUnprocessed(50);
    this.logger.log(
      `运行底座心跳完成：执行任务 ${processed} 条，补漏消息 ${caughtUp} 条`,
    );
  }

  @BindTrigger('flowrule_catchup_tick')
  async catchupTick(): Promise<void> {
    this.logger.log('消息补漏：处理未消费的历史消息事件');
    const caughtUp = await this.dispatcherService.processUnprocessed(100);
    const processed = await this.taskRunService.processDue(20);
    this.logger.log(
      `消息补漏完成：补漏消息 ${caughtUp} 条，执行任务 ${processed} 条`,
    );
  }
}

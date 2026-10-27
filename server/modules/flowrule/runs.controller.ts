import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { TaskRunService } from './task-run.service';
import { TaskRunListQueryDto } from './dtos';
import type { TaskRun, TaskRunStats } from '@shared/api.interface';

@Controller('api/runs')
@NeedLogin()
export class RunsController {
  constructor(private readonly taskRunService: TaskRunService) {}

  @Get()
  async list(
    @Query() query: TaskRunListQueryDto,
  ): Promise<{ items: TaskRun[]; stats: TaskRunStats }> {
    return this.taskRunService.list(query);
  }

  @Get('stats')
  async stats(): Promise<TaskRunStats> {
    return this.taskRunService.stats();
  }

  @Post(':id/retry')
  async retry(@Req() req: Request, @Param('id') id: string): Promise<TaskRun> {
    return this.taskRunService.retry(id, req.userContext.userId);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: Request, @Param('id') id: string): Promise<TaskRun> {
    return this.taskRunService.cancel(id, req.userContext.userId);
  }
}

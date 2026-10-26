import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { WorkspaceService } from './workspace.service';
import { WorkspaceSettingsDto } from './dtos';
import { SeedService } from './seed.service';

@Controller('api/workspace')
@NeedLogin()
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly seedService: SeedService,
  ) {}

  @Get()
  async get() {
    await this.seedService.ensureSeeded();
    return this.workspaceService.get();
  }

  @Patch()
  async update(@Req() req: Request, @Body() dto: WorkspaceSettingsDto) {
    return this.workspaceService.update(dto, req.userContext.userId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { RulesService } from './rules.service';
import {
  PublishDto,
  RollbackDto,
  RuleListQueryDto,
  RulePayloadDto,
  RuleStatusDto,
  RuleUpdateDto,
} from './dtos';
import { SeedService } from './seed.service';

@Controller('api/rules')
@NeedLogin()
export class RulesController {
  constructor(
    private readonly rulesService: RulesService,
    private readonly seedService: SeedService,
  ) {}

  @Get()
  async list(@Query() query: RuleListQueryDto) {
    await this.seedService.ensureSeeded();
    return this.rulesService.list(query);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: RulePayloadDto) {
    return this.rulesService.create(dto, req.userContext.userId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.rulesService.get(id);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RuleUpdateDto,
  ) {
    return this.rulesService.update(id, dto, req.userContext.userId);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.rulesService.remove(id, req.userContext.userId);
    return { ok: true };
  }

  @Post(':id/duplicate')
  async duplicate(@Req() req: Request, @Param('id') id: string) {
    return this.rulesService.duplicate(id, req.userContext.userId);
  }

  @Post(':id/status')
  async setStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RuleStatusDto,
  ) {
    return this.rulesService.setStatus(id, dto.status, req.userContext.userId);
  }

  @Get(':id/versions')
  async versions(@Param('id') id: string) {
    return this.rulesService.versions(id);
  }

  @Post(':id/validate')
  async validate(@Param('id') id: string) {
    return this.rulesService.validate(id);
  }

  @Post(':id/publish')
  async publish(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PublishDto,
  ) {
    return this.rulesService.publish(id, dto.changelog ?? '', req.userContext.userId);
  }

  @Post(':id/rollback')
  async rollback(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RollbackDto,
  ) {
    return this.rulesService.rollback(id, dto.versionId, req.userContext.userId);
  }
}

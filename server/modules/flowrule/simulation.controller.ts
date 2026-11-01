import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { SimulationService } from './simulation.service';
import { SimulationRunDto } from './dtos';
import { SeedService } from './seed.service';

@Controller('api/simulations')
@NeedLogin()
export class SimulationController {
  constructor(
    private readonly simulationService: SimulationService,
    private readonly seedService: SeedService,
  ) {}

  @Get()
  async list(@Query('ruleId') ruleId?: string, @Query('limit') limit?: string) {
    await this.seedService.ensureSeeded();
    const parsedLimit = limit ? Number(limit) : 50;
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    return this.simulationService.list(ruleId, safeLimit);
  }

  @Post('run')
  async run(@Req() req: Request, @Body() dto: SimulationRunDto) {
    return this.simulationService.run(dto.ruleId, dto.input, req.userContext.userId);
  }
}

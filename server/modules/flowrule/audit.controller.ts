import { Controller, Get, Query } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { AuditService } from './audit.service';
import { AuditListQueryDto } from './dtos';
import { SeedService } from './seed.service';

@Controller('api/audit')
@NeedLogin()
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly seedService: SeedService,
  ) {}

  @Get()
  async list(@Query() query: AuditListQueryDto) {
    await this.seedService.ensureSeeded();
    return this.auditService.list(query);
  }
}

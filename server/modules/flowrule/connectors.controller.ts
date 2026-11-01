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
import { ConnectorsService } from './connectors.service';
import { ConnectorOAuthExchangeDto, ConnectorPayloadDto } from './dtos';
import { SeedService } from './seed.service';

@Controller('api/connectors')
@NeedLogin()
export class ConnectorsController {
  constructor(
    private readonly connectorsService: ConnectorsService,
    private readonly seedService: SeedService,
  ) {}

  @Get()
  async list() {
    await this.seedService.ensureSeeded();
    return this.connectorsService.list();
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: ConnectorPayloadDto) {
    return this.connectorsService.create(dto, req.userContext.userId);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ConnectorPayloadDto,
  ) {
    return this.connectorsService.update(id, dto, req.userContext.userId);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.connectorsService.remove(id, req.userContext.userId);
    return { ok: true };
  }

  @Post(':id/check')
  async check(@Req() req: Request, @Param('id') id: string) {
    return this.connectorsService.check(id, req.userContext.userId);
  }

  @Post(':id/sync-chats')
  async syncChats(@Req() req: Request, @Param('id') id: string) {
    return this.connectorsService.syncChats(id, req.userContext.userId);
  }

  @Get(':id/user-oauth-url')
  async userOAuthUrl(
    @Param('id') id: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    return this.connectorsService.getUserOAuthUrl(id, redirectUri);
  }

  @Post(':id/user-oauth-exchange')
  async userOAuthExchange(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ConnectorOAuthExchangeDto,
  ) {
    return this.connectorsService.exchangeUserOAuth(
      id,
      dto.code,
      dto.redirectUri,
      req.userContext.userId,
    );
  }
}

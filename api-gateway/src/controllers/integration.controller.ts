import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateIntegrationDto } from '../dto/integration.dto';
import { IntegrationService } from '../services/integration.service';

@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  async listIntegrations(@CurrentUser() user: AuthUser) {
    return this.integrationService.listIntegrations(user.tenantId);
  }

  @Post()
  async createIntegration(@Body() dto: CreateIntegrationDto, @CurrentUser() user: AuthUser) {
    return this.integrationService.createIntegration(user.tenantId, user.tenantRole, dto);
  }

  @Post(':id/sync')
  async syncIntegration(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.integrationService.syncIntegration(user.tenantId, user.tenantRole, id);
  }
}

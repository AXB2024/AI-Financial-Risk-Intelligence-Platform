import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateApiKeyDto } from '../dto/developer.dto';
import { ApiKeyService } from '../services/api-key.service';

@Controller('api/v1/developer')
@UseGuards(JwtAuthGuard)
export class DeveloperController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('api-keys')
  async createApiKey(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthUser) {
    return this.apiKeyService.createApiKey(user.tenantId, user.id, user.tenantRole, dto);
  }

  @Get('api-keys')
  async listApiKeys(@CurrentUser() user: AuthUser) {
    return this.apiKeyService.listApiKeys(user.tenantId, user.tenantRole);
  }

  @Delete('api-keys/:id')
  async revokeApiKey(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.apiKeyService.revokeApiKey(user.tenantId, user.tenantRole, id);
  }
}

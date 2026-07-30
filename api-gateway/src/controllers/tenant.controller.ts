import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InviteMemberDto, UpdateBrandingDto } from '../dto/tenant.dto';
import { TenantService } from '../services/tenant.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('tenants')
  async listTenants(@CurrentUser() user: AuthUser) {
    return this.tenantService.listTenants(user.id);
  }

  @Get('branding/current')
  async getBranding(@CurrentUser() user: AuthUser) {
    return this.tenantService.getBranding(user.tenantId);
  }

  @Patch('admin/branding')
  async updateBranding(@Body() dto: UpdateBrandingDto, @CurrentUser() user: AuthUser) {
    return this.tenantService.updateBranding(user.tenantId, user.tenantRole, dto);
  }

  @Get('admin/members')
  async listMembers(@CurrentUser() user: AuthUser) {
    return this.tenantService.listMembers(user.tenantId, user.tenantRole);
  }

  @Post('admin/members')
  async inviteMember(@Body() dto: InviteMemberDto, @CurrentUser() user: AuthUser) {
    return this.tenantService.inviteMember(user.tenantId, user.tenantRole, dto);
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReportTemplateDto, CreateScheduledExportDto } from '../dto/reporting.dto';
import { ReportingService } from '../services/reporting.service';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post('templates')
  async createTemplate(@Body() dto: CreateReportTemplateDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.createTemplate(user.tenantId, user.tenantRole, dto);
  }

  @Get('templates')
  async listTemplates(@CurrentUser() user: AuthUser) {
    return this.reportingService.listTemplates(user.tenantId);
  }

  @Post('schedules')
  async createSchedule(@Body() dto: CreateScheduledExportDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.createSchedule(user.tenantId, user.tenantRole, dto);
  }

  @Get('schedules')
  async listSchedules(@CurrentUser() user: AuthUser) {
    return this.reportingService.listSchedules(user.tenantId);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  IngestIbkrFlexDto,
  PositionSnapshotQueryDto,
  ReconciliationRunDto,
  ResolveSecurityDto,
  CreateCorporateActionDto,
  UpdateBreakDto,
  UpdateQuarantineDto,
} from '../dto/data-connectivity.dto';
import { DataConnectivityService } from '../services/data-connectivity.service';
import { SecurityMasterService } from '../services/security-master.service';

@Controller('api/v1/data')
@UseGuards(JwtAuthGuard)
export class DataConnectivityController {
  constructor(
    private readonly dataConnectivityService: DataConnectivityService,
    private readonly securityMasterService: SecurityMasterService,
  ) {}

  @Post('securities/resolve')
  async resolveSecurity(@Body() dto: ResolveSecurityDto) {
    return this.securityMasterService.resolveSecurity(dto);
  }

  @Post('ingestion/ibkr-flex')
  async ingestIbkrFlex(@Body() dto: IngestIbkrFlexDto, @CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.ingestIbkrFlex(user.tenantId, user.tenantRole, dto);
  }

  @Get('positions/snapshot')
  async getPositionSnapshot(@Query() query: PositionSnapshotQueryDto, @CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.getPositionSnapshot(user.tenantId, query);
  }

  @Post('reconciliation/runs')
  async runReconciliation(@Body() dto: ReconciliationRunDto, @CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.runReconciliation(user.tenantId, user.tenantRole, dto);
  }

  @Get('reconciliation/breaks')
  async listBreaks(@CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.listBreaks(user.tenantId);
  }

  @Patch('reconciliation/breaks/:id')
  async updateBreak(@Param('id') id: string, @Body() dto: UpdateBreakDto, @CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.updateBreak(user.tenantId, user.tenantRole, id, dto);
  }

  @Get('quarantine')
  async listQuarantine(@CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.listQuarantine(user.tenantId);
  }

  @Patch('quarantine/:id')
  async updateQuarantine(
    @Param('id') id: string,
    @Body() dto: UpdateQuarantineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dataConnectivityService.updateQuarantine(user.tenantId, user.tenantRole, id, dto);
  }

  @Get('corporate-actions')
  async listCorporateActions() {
    return this.dataConnectivityService.listCorporateActions();
  }

  @Post('corporate-actions')
  async createCorporateAction(@Body() dto: CreateCorporateActionDto, @CurrentUser() user: AuthUser) {
    return this.dataConnectivityService.createCorporateAction(user.tenantRole, dto);
  }
}

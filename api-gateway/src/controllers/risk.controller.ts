import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAnalysisDto } from '../dto/create-analysis.dto';
import { API_ROUTES } from '../routes/api-routes';
import { RiskOrchestrationService } from '../services/risk-orchestration.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly riskService: RiskOrchestrationService) {}

  @Get(`${API_ROUTES.risk}/:id`)
  async getRisk(@Param('id') portfolioId: string, @CurrentUser() user: AuthUser) {
    return this.riskService.calculateRisk(portfolioId, user.id, user.tenantId);
  }

  @Post('analyses')
  async createAnalysis(@Body() dto: CreateAnalysisDto, @CurrentUser() user: AuthUser) {
    return this.riskService.createAnalysis(dto.portfolioId, user.id, user.tenantId);
  }

  @Get('analyses/:id')
  async getAnalysis(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.riskService.getAnalysis(id, user.id, user.tenantId);
  }

  @Get('portfolios/:id/analyses')
  async listAnalyses(@Param('id') portfolioId: string, @CurrentUser() user: AuthUser) {
    return this.riskService.listAnalyses(portfolioId, user.id, user.tenantId);
  }

  @Get('portfolios/:id/analyses/compare')
  async compareAnalyses(
    @Param('id') portfolioId: string,
    @Query('from') fromId: string,
    @Query('to') toId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.riskService.compareAnalyses(portfolioId, user.id, user.tenantId, fromId, toId);
  }

  @Get('portfolios/:id/backtest')
  async backtestPortfolio(
    @Param('id') portfolioId: string,
    @Query('periods') periods: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.riskService.backtestPortfolio(portfolioId, user.id, user.tenantId, periods ? Number(periods) : 180);
  }
}

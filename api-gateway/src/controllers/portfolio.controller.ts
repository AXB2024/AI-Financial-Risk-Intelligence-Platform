import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { API_ROUTES } from '../routes/api-routes';
import { PortfolioService } from '../services/portfolio.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post(API_ROUTES.portfolio)
  async createPortfolio(@Body() dto: CreatePortfolioDto, @CurrentUser() user: AuthUser) {
    return this.portfolioService.createPortfolio(dto, user.id, user.tenantId);
  }

  @Get('portfolios')
  async listPortfolios(@CurrentUser() user: AuthUser) {
    return this.portfolioService.listPortfolios(user.id, user.tenantId);
  }

  @Get('portfolios/:id')
  async getPortfolio(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.portfolioService.getPortfolioResponse(id, user.id, user.tenantId);
  }
}

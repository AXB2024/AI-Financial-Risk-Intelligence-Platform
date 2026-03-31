import { Body, Controller, Post } from '@nestjs/common';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { API_ROUTES } from '../routes/api-routes';
import { PortfolioService } from '../services/portfolio.service';

@Controller()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post(API_ROUTES.portfolio)
  async createPortfolio(@Body() dto: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(dto);
  }
}

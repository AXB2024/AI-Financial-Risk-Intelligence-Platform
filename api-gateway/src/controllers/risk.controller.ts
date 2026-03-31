import { Controller, Get, Param } from '@nestjs/common';
import { API_ROUTES } from '../routes/api-routes';
import { RiskOrchestrationService } from '../services/risk-orchestration.service';

@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskOrchestrationService) {}

  @Get(`${API_ROUTES.risk}/:id`)
  async getRisk(@Param('id') portfolioId: string) {
    return this.riskService.calculateRisk(portfolioId);
  }
}

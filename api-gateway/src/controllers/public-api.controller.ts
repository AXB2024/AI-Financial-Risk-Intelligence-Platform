import { Controller, Get, Headers, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '../services/api-key.service';
import { PortfolioService } from '../services/portfolio.service';

@Controller('api/v1/public')
export class PublicApiController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly portfolioService: PortfolioService,
  ) {}

  @Get('portfolios')
  async listPortfolios(@Headers('x-api-key') apiKey: string | undefined, @Req() request: Request) {
    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const principal = await this.apiKeyService.validateApiKey(apiKey, 'portfolios:read', {
      path: request.path,
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return this.portfolioService.listTenantPortfolios(principal.tenantId);
  }
}

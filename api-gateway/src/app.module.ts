import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from './config/database.config';
import { HealthController } from './controllers/health.controller';
import { PortfolioController } from './controllers/portfolio.controller';
import { RiskController } from './controllers/risk.controller';
import { AnalysisLogEntity } from './entities/analysis-log.entity';
import { PortfolioAssetEntity } from './entities/portfolio-asset.entity';
import { PortfolioEntity } from './entities/portfolio.entity';
import { RiskResultEntity } from './entities/risk-result.entity';
import { DatabaseConnectionService } from './services/database-connection.service';
import { LoggingService } from './services/logging.service';
import { MarketDataService } from './services/market-data.service';
import { MlClientService } from './services/ml-client.service';
import { PortfolioService } from './services/portfolio.service';
import { RiskOrchestrationService } from './services/risk-orchestration.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([
      PortfolioEntity,
      PortfolioAssetEntity,
      RiskResultEntity,
      AnalysisLogEntity,
    ]),
  ],
  controllers: [HealthController, PortfolioController, RiskController],
  providers: [
    PortfolioService,
    RiskOrchestrationService,
    MlClientService,
    MarketDataService,
    LoggingService,
    DatabaseConnectionService,
  ],
})
export class AppModule {}

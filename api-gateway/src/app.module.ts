import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './auth/jwt.strategy';
import { typeOrmAsyncConfig } from './config/database.config';
import { AuthController } from './controllers/auth.controller';
import { DataConnectivityController } from './controllers/data-connectivity.controller';
import { DeveloperController } from './controllers/developer.controller';
import { HealthController } from './controllers/health.controller';
import { IntegrationController } from './controllers/integration.controller';
import { PortfolioController } from './controllers/portfolio.controller';
import { PublicApiController } from './controllers/public-api.controller';
import { ReportingController } from './controllers/reporting.controller';
import { RiskController } from './controllers/risk.controller';
import { TenantController } from './controllers/tenant.controller';
import { AnalysisLogEntity } from './entities/analysis-log.entity';
import { ApiKeyEntity } from './entities/api-key.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { CorporateActionEntity } from './entities/corporate-action.entity';
import { IngestionRunEntity } from './entities/ingestion-run.entity';
import { IntegrationEntity } from './entities/integration.entity';
import { PortfolioAssetEntity } from './entities/portfolio-asset.entity';
import { PortfolioEntity } from './entities/portfolio.entity';
import { PositionLedgerEntity } from './entities/position-ledger.entity';
import { QuarantineRecordEntity } from './entities/quarantine-record.entity';
import { ReconciliationBreakEntity } from './entities/reconciliation-break.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { ReportTemplateEntity } from './entities/report-template.entity';
import { RiskResultEntity } from './entities/risk-result.entity';
import { ScheduledExportEntity } from './entities/scheduled-export.entity';
import { SecurityMasterEntity } from './entities/security-master.entity';
import { TenantBrandingEntity } from './entities/tenant-branding.entity';
import { TenantMembershipEntity } from './entities/tenant-membership.entity';
import { TenantEntity } from './entities/tenant.entity';
import { TransactionLedgerEntity } from './entities/transaction-ledger.entity';
import { UserEntity } from './entities/user.entity';
import { AuditLoggingInterceptor } from './interceptors/audit-logging.interceptor';
import { ApiKeyService } from './services/api-key.service';
import { AuthService } from './services/auth.service';
import { AuditLogService } from './services/audit-log.service';
import { BackgroundJobService } from './services/background-job.service';
import { DatabaseConnectionService } from './services/database-connection.service';
import { DataConnectivityService } from './services/data-connectivity.service';
import { FinnhubService } from './services/finnhub.service';
import { LoggingService } from './services/logging.service';
import { MarketDataService } from './services/market-data.service';
import { MlClientService } from './services/ml-client.service';
import { PortfolioService } from './services/portfolio.service';
import { RedisCacheService } from './services/redis-cache.service';
import { ReportingService } from './services/reporting.service';
import { RiskOrchestrationService } from './services/risk-orchestration.service';
import { SecurityMasterService } from './services/security-master.service';
import { TenantService } from './services/tenant.service';
import { UsersService } from './services/users.service';
import { IntegrationService } from './services/integration.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    PassportModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: Number(configService.get<string>('RATE_LIMIT_TTL_MS', '60000')),
          limit: Number(configService.get<string>('RATE_LIMIT_MAX', '120')),
        },
      ],
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-only-change-me'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '1h',
          ) as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
        },
      }),
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([
      UserEntity,
      TenantEntity,
      TenantMembershipEntity,
      TenantBrandingEntity,
      ApiKeyEntity,
      AuditLogEntity,
      IntegrationEntity,
      SecurityMasterEntity,
      CorporateActionEntity,
      IngestionRunEntity,
      PositionLedgerEntity,
      TransactionLedgerEntity,
      QuarantineRecordEntity,
      ReconciliationRunEntity,
      ReconciliationBreakEntity,
      RefreshTokenEntity,
      ReportTemplateEntity,
      ScheduledExportEntity,
      PortfolioEntity,
      PortfolioAssetEntity,
      RiskResultEntity,
      AnalysisLogEntity,
    ]),
  ],
  controllers: [
    AuthController,
    DataConnectivityController,
    HealthController,
    PortfolioController,
    RiskController,
    TenantController,
    DeveloperController,
    PublicApiController,
    IntegrationController,
    ReportingController,
  ],
  providers: [
    AuthService,
    DataConnectivityService,
    AuditLogService,
    UsersService,
    TenantService,
    ApiKeyService,
    IntegrationService,
    ReportingService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor,
    },
    PortfolioService,
    RiskOrchestrationService,
    SecurityMasterService,
    BackgroundJobService,
    RedisCacheService,
    MlClientService,
    MarketDataService,
    FinnhubService,
    LoggingService,
    DatabaseConnectionService,
  ],
})
export class AppModule {}

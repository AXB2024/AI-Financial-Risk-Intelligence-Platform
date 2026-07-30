import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportTemplateDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsIn(['risk_summary', 'tail_risk', 'backtest', 'audit'])
  type!: 'risk_summary' | 'tail_risk' | 'backtest' | 'audit';

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class CreateScheduledExportDto {
  @IsString()
  reportTemplateId!: string;

  @IsIn(['daily', 'weekly', 'monthly'])
  cadence!: 'daily' | 'weekly' | 'monthly';

  @IsIn(['email', 's3', 'webhook', 'crm'])
  destinationType!: 'email' | 's3' | 'webhook' | 'crm';

  @IsOptional()
  @IsObject()
  destinationConfig?: Record<string, unknown>;
}

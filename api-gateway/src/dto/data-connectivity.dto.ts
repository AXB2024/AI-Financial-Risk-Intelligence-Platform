import { IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveSecurityDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ticker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  cusip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  isin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  sedol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  figi?: string;
}

export class IngestIbkrFlexDto {
  @IsString()
  xml!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalAccountId?: string;
}

export class PositionSnapshotQueryDto {
  @IsOptional()
  @IsISO8601()
  validAt?: string;

  @IsOptional()
  @IsISO8601()
  systemAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalAccountId?: string;
}

export class ReconciliationRunDto {
  @IsISO8601()
  asOfDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalAccountId?: string;
}

export class UpdateBreakDto {
  @IsIn(['open', 'assigned', 'resolved', 'ignored'])
  status!: 'open' | 'assigned' | 'resolved' | 'ignored';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  assignedTo?: string;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class UpdateQuarantineDto {
  @IsIn(['open', 'resolved', 'ignored'])
  status!: 'open' | 'resolved' | 'ignored';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateCorporateActionDto {
  @IsIn(['split', 'dividend', 'spinoff', 'merger', 'symbol_change'])
  actionType!: 'split' | 'dividend' | 'spinoff' | 'merger' | 'symbol_change';

  @IsISO8601()
  exDate!: string;

  @IsOptional()
  @IsISO8601()
  payDate?: string;

  @IsOptional()
  @IsString()
  securityId?: string;

  @IsOptional()
  @IsString()
  ticker?: string;

  @IsOptional()
  @IsString()
  ratio?: string;

  @IsOptional()
  @IsString()
  cashAmount?: string;

  @IsOptional()
  @IsString()
  fromSymbol?: string;

  @IsOptional()
  @IsString()
  toSymbol?: string;

  @IsOptional()
  @IsObject()
  rawJson?: Record<string, unknown>;
}

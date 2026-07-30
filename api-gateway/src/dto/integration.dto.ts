import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @MaxLength(80)
  provider!: string;

  @IsIn(['brokerage', 'crm', 'storage', 'webhook'])
  category!: 'brokerage' | 'crm' | 'storage' | 'webhook';

  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;
}

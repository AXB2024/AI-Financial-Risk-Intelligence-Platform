import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['portfolios:read', 'portfolios:write', 'analyses:read', 'analyses:write', 'reports:read'], {
    each: true,
  })
  scopes!: string[];

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

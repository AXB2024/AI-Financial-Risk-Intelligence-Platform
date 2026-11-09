import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitPerMinute?: number;
}

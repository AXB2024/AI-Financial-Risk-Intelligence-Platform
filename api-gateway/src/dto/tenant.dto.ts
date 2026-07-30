import { IsEmail, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { TenantRole } from '../entities/tenant-membership.entity';

export class UpdateBrandingDto {
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  legalDisclaimer?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(['admin', 'analyst', 'viewer', 'developer'])
  role!: Exclude<TenantRole, 'owner'>;
}

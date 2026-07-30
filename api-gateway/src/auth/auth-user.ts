import { UserTier } from '../entities/user.entity';
import { TenantRole } from '../entities/tenant-membership.entity';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  tenantId: string;
  tenantSlug: string;
  tenantRole: TenantRole;
}

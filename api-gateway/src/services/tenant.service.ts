import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InviteMemberDto, UpdateBrandingDto } from '../dto/tenant.dto';
import { TenantBrandingEntity } from '../entities/tenant-branding.entity';
import { TenantMembershipEntity, TenantRole } from '../entities/tenant-membership.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(TenantMembershipEntity)
    private readonly membershipRepository: Repository<TenantMembershipEntity>,
    @InjectRepository(TenantBrandingEntity)
    private readonly brandingRepository: Repository<TenantBrandingEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createPersonalTenant(user: UserEntity, name: string) {
    const tenant = await this.tenantRepository.save(
      this.tenantRepository.create({
        name: `${name.trim() || 'Personal'} Workspace`,
        slug: await this.buildUniqueSlug(name || user.email),
        plan: 'starter',
        status: 'active',
      }),
    );

    await this.membershipRepository.save(
      this.membershipRepository.create({
        tenant,
        user,
        role: 'owner',
      }),
    );

    await this.brandingRepository.save(
      this.brandingRepository.create({
        tenant,
      }),
    );

    return tenant;
  }

  async getDefaultMembership(userId: string) {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId } },
      relations: { tenant: true, user: true },
      order: { createdAt: 'ASC' },
    });

    if (!membership) {
      throw new NotFoundException('Tenant membership not found');
    }

    return membership;
  }

  async getOrCreateDefaultMembership(user: UserEntity) {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: user.id } },
      relations: { tenant: true, user: true },
      order: { createdAt: 'ASC' },
    });

    if (membership) {
      return membership;
    }

    const tenant = await this.createPersonalTenant(user, user.name || user.email);
    await this.backfillLegacyTenantData(user.id, tenant.id);

    return this.getDefaultMembership(user.id);
  }

  async getMembership(userId: string, tenantId: string) {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId }, tenant: { id: tenantId } },
      relations: { tenant: true, user: true },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this tenant');
    }

    return membership;
  }

  async listTenants(userId: string) {
    const memberships = await this.membershipRepository.find({
      where: { user: { id: userId } },
      relations: { tenant: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      plan: membership.tenant.plan,
      status: membership.tenant.status,
      role: membership.role,
    }));
  }

  async getBranding(tenantId: string) {
    const branding = await this.brandingRepository.findOne({
      where: { tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (branding) {
      return this.toBrandingResponse(branding);
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.toBrandingResponse(await this.brandingRepository.save(this.brandingRepository.create({ tenant })));
  }

  async updateBranding(tenantId: string, role: TenantRole, dto: UpdateBrandingDto) {
    this.requireAdmin(role);
    let branding = await this.brandingRepository.findOne({
      where: { tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (!branding) {
      const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      branding = this.brandingRepository.create({ tenant });
    }

    Object.assign(branding, dto);
    return this.toBrandingResponse(await this.brandingRepository.save(branding));
  }

  async listMembers(tenantId: string, role: TenantRole) {
    this.requireAdmin(role);
    const memberships = await this.membershipRepository.find({
      where: { tenant: { id: tenantId } },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      createdAt: membership.createdAt,
    }));
  }

  async inviteMember(tenantId: string, role: TenantRole, dto: InviteMemberDto) {
    this.requireAdmin(role);
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    let user = await this.userRepository.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          email: dto.email.toLowerCase(),
          name: dto.name,
          passwordHash: 'invite-pending',
          tier: 'free',
        }),
      );
    }

    const existing = await this.membershipRepository.findOne({
      where: { tenant: { id: tenantId }, user: { id: user.id } },
    });

    if (existing) {
      existing.role = dto.role;
      return this.membershipRepository.save(existing);
    }

    return this.membershipRepository.save(
      this.membershipRepository.create({
        tenant,
        user,
        role: dto.role,
      }),
    );
  }

  private requireAdmin(role: TenantRole) {
    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Tenant admin access required');
    }
  }

  private async buildUniqueSlug(input: string) {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'tenant';

    for (let i = 0; i < 20; i += 1) {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      const existing = await this.tenantRepository.findOne({ where: { slug } });
      if (!existing) {
        return slug;
      }
    }

    return `${base}-${Date.now()}`;
  }

  private toBrandingResponse(branding: TenantBrandingEntity) {
    return {
      tenantId: branding.tenant.id,
      tenantName: branding.tenant.name,
      tenantSlug: branding.tenant.slug,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      customDomain: branding.customDomain,
      supportEmail: branding.supportEmail,
      legalDisclaimer: branding.legalDisclaimer,
      updatedAt: branding.updatedAt,
    };
  }

  private async backfillLegacyTenantData(userId: string, tenantId: string) {
    await this.dataSource.query(
      'UPDATE portfolios SET tenant_id = $1 WHERE user_id = $2 AND tenant_id IS NULL',
      [tenantId, userId],
    );
    await this.dataSource.query(
      `UPDATE risk_results
       SET tenant_id = $1
       WHERE tenant_id IS NULL
       AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = $2)`,
      [tenantId, userId],
    );
    await this.dataSource.query(
      'UPDATE audit_logs SET tenant_id = $1 WHERE user_id = $2 AND tenant_id IS NULL',
      [tenantId, userId],
    );
  }
}

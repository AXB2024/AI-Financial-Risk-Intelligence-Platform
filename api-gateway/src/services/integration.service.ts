import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateIntegrationDto } from '../dto/integration.dto';
import { IntegrationEntity } from '../entities/integration.entity';
import { TenantRole } from '../entities/tenant-membership.entity';
import { TenantEntity } from '../entities/tenant.entity';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectRepository(IntegrationEntity)
    private readonly integrationRepository: Repository<IntegrationEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async listIntegrations(tenantId: string) {
    return this.withTenant(tenantId, (manager) => manager.getRepository(IntegrationEntity).find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
    }));
  }

  async createIntegration(tenantId: string, role: TenantRole, dto: CreateIntegrationDto) {
    this.requireAdmin(role);
    return this.withTenant(tenantId, async (manager) => {
    const tenant = await manager.getRepository(TenantEntity).findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return manager.getRepository(IntegrationEntity).save(
      manager.getRepository(IntegrationEntity).create({
        tenant,
        provider: dto.provider,
        category: dto.category,
        status: 'connected',
        externalAccountId: dto.externalAccountId ?? null,
        metadataJson: dto.metadataJson ?? {},
      }),
    );
    });
  }

  async syncIntegration(tenantId: string, role: TenantRole, integrationId: string) {
    this.requireAdmin(role);
    return this.withTenant(tenantId, async (manager) => {
    const integration = await manager.getRepository(IntegrationEntity).findOne({
      where: { id: integrationId, tenant: { id: tenantId } },
    });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    integration.lastSyncAt = new Date();
    integration.status = 'connected';
    return manager.getRepository(IntegrationEntity).save(integration);
    });
  }

  private async withTenant<T>(tenantId: string, work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return work(manager);
    });
  }

  private requireAdmin(role: TenantRole) {
    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Tenant admin access required');
    }
  }
}

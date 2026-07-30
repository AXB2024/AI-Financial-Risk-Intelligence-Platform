import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async listIntegrations(tenantId: string) {
    return this.integrationRepository.find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
    });
  }

  async createIntegration(tenantId: string, role: TenantRole, dto: CreateIntegrationDto) {
    this.requireAdmin(role);
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.integrationRepository.save(
      this.integrationRepository.create({
        tenant,
        provider: dto.provider,
        category: dto.category,
        status: 'connected',
        externalAccountId: dto.externalAccountId ?? null,
        metadataJson: dto.metadataJson ?? {},
      }),
    );
  }

  async syncIntegration(tenantId: string, role: TenantRole, integrationId: string) {
    this.requireAdmin(role);
    const integration = await this.integrationRepository.findOne({
      where: { id: integrationId, tenant: { id: tenantId } },
    });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    integration.lastSyncAt = new Date();
    integration.status = 'connected';
    return this.integrationRepository.save(integration);
  }

  private requireAdmin(role: TenantRole) {
    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Tenant admin access required');
    }
  }
}

import { randomBytes, createHash } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateApiKeyDto } from '../dto/developer.dto';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { TenantRole } from '../entities/tenant-membership.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity } from '../entities/user.entity';

export interface ApiKeyPrincipal {
  tenantId: string;
  scopes: string[];
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async createApiKey(tenantId: string, userId: string, role: TenantRole, dto: CreateApiKeyDto) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new ForbiddenException('Developer access required');
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!tenant || !user) {
      throw new NotFoundException('Tenant or user not found');
    }

    const rawKey = `frp_${randomBytes(24).toString('hex')}`;
    const entity = await this.apiKeyRepository.save(
      this.apiKeyRepository.create({
        tenant,
        createdBy: user,
        name: dto.name,
        keyHash: this.hashKey(rawKey),
        keyPrefix: rawKey.slice(0, 12),
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );

    return {
      id: entity.id,
      name: entity.name,
      key: rawKey,
      keyPrefix: entity.keyPrefix,
      scopes: entity.scopes,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
    };
  }

  async listApiKeys(tenantId: string, role: TenantRole) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new ForbiddenException('Developer access required');
    }

    const keys = await this.apiKeyRepository.find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    }));
  }

  async revokeApiKey(tenantId: string, role: TenantRole, keyId: string) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new ForbiddenException('Developer access required');
    }

    const key = await this.apiKeyRepository.findOne({
      where: { id: keyId, tenant: { id: tenantId } },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }

    key.revokedAt = new Date();
    await this.apiKeyRepository.save(key);
    return { id: key.id, revokedAt: key.revokedAt };
  }

  async validateApiKey(rawKey: string, requiredScope: string): Promise<ApiKeyPrincipal> {
    const key = await this.apiKeyRepository.findOne({
      where: { keyHash: this.hashKey(rawKey) },
      relations: { tenant: true },
    });

    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      throw new ForbiddenException('Invalid API key');
    }

    if (!key.scopes.includes(requiredScope)) {
      throw new ForbiddenException('API key scope is not sufficient');
    }

    key.lastUsedAt = new Date();
    await this.apiKeyRepository.save(key);

    return {
      tenantId: key.tenant.id,
      scopes: key.scopes,
    };
  }

  private hashKey(rawKey: string) {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}

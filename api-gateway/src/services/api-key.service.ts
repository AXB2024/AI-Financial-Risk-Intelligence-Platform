import { randomBytes } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateApiKeyDto } from '../dto/developer.dto';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { TenantRole } from '../entities/tenant-membership.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity } from '../entities/user.entity';
import { AuditLogService } from './audit-log.service';
import { RedisCacheService } from './redis-cache.service';

export interface ApiKeyPrincipal {
  tenantId: string;
  apiKeyId: string;
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
    private readonly cacheService: RedisCacheService,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  async createApiKey(tenantId: string, userId: string, role: TenantRole, dto: CreateApiKeyDto) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new ForbiddenException('Developer access required');
    }

    return this.withTenant(tenantId, async (manager) => {
    const tenant = await manager.getRepository(TenantEntity).findOne({ where: { id: tenantId } });
    const user = await manager.getRepository(UserEntity).findOne({ where: { id: userId } });
    if (!tenant || !user) {
      throw new NotFoundException('Tenant or user not found');
    }

    const rawKey = `frp_live_${randomBytes(32).toString('hex')}`;
    const entity = await manager.getRepository(ApiKeyEntity).save(
      manager.getRepository(ApiKeyEntity).create({
        tenant,
        createdBy: user,
        name: dto.name,
        keyHash: await this.hashKey(rawKey),
        keyPrefix: rawKey.slice(0, 16),
        keyLastFour: rawKey.slice(-4),
        scopes: dto.scopes,
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 120,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );

    return {
      id: entity.id,
      name: entity.name,
      key: rawKey,
      keyPrefix: entity.keyPrefix,
      keyLastFour: entity.keyLastFour,
      scopes: entity.scopes,
      rateLimitPerMinute: entity.rateLimitPerMinute,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
    };
    });
  }

  async listApiKeys(tenantId: string, role: TenantRole) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new ForbiddenException('Developer access required');
    }

    const keys = await this.withTenant(tenantId, async (manager) => manager.getRepository(ApiKeyEntity).find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
    }));

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      keyLastFour: key.keyLastFour,
      scopes: key.scopes,
      rateLimitPerMinute: key.rateLimitPerMinute,
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

    return this.withTenant(tenantId, async (manager) => {
    const key = await manager.getRepository(ApiKeyEntity).findOne({
      where: { id: keyId, tenant: { id: tenantId } },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }

    key.revokedAt = new Date();
    await manager.getRepository(ApiKeyEntity).save(key);
    return { id: key.id, revokedAt: key.revokedAt };
    });
  }

  async validateApiKey(
    rawKey: string,
    requiredScope: string,
    context: { path?: string; ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ApiKeyPrincipal> {
    const key = await this.findKeyByRawValue(rawKey);
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      throw new ForbiddenException('Invalid API key');
    }

    await this.enforceRateLimit(key);

    if (!key.scopes.includes(requiredScope)) {
      throw new ForbiddenException('API key scope is not sufficient');
    }

    await this.withTenant(key.tenant.id, async (manager) => {
      await manager.getRepository(ApiKeyEntity).update(key.id, { lastUsedAt: new Date() });
    });

    await this.auditLogService.record({
      userId: null,
      tenantId: key.tenant.id,
      apiKeyId: key.id,
      actorType: 'api_key',
      method: 'API_KEY',
      path: context.path ?? requiredScope,
      statusCode: 200,
      durationMs: 0,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return {
      tenantId: key.tenant.id,
      apiKeyId: key.id,
      scopes: key.scopes,
    };
  }

  private async findKeyByRawValue(rawKey: string) {
    const keyPrefix = rawKey.slice(0, 16);
    const candidates = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.api_key_prefix', keyPrefix]);
      return manager.getRepository(ApiKeyEntity).find({
      where: { keyPrefix },
      relations: { tenant: true },
      });
    });

    for (const candidate of candidates) {
      if (await argon2.verify(candidate.keyHash, rawKey)) {
        return candidate;
      }
    }
    return null;
  }

  private async enforceRateLimit(key: ApiKeyEntity) {
    const cacheKey = `api-key-rate:${key.id}:${Math.floor(Date.now() / 60000)}`;
    const current = (await this.cacheService.getJson<{ count: number }>(cacheKey)) ?? { count: 0 };
    if (current.count >= key.rateLimitPerMinute) {
      throw new ForbiddenException('API key rate limit exceeded');
    }
    await this.cacheService.setJson(cacheKey, { count: current.count + 1 }, 70);
  }

  private async hashKey(rawKey: string) {
    return argon2.hash(rawKey, { type: argon2.argon2id });
  }

  private async withTenant<T>(tenantId: string, work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return work(manager);
    });
  }
}

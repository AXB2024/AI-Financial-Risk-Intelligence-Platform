import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { PortfolioEntity } from '../entities/portfolio.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity } from '../entities/user.entity';
import { decimal, decimalSum, toNumericString } from '../utils/round.util';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioEntity)
    private readonly portfolioRepository: Repository<PortfolioEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createPortfolio(dto: CreatePortfolioDto, userId: string, tenantId: string) {
    return this.withTenant(tenantId, async (manager) => {
    const user = await manager.getRepository(UserEntity).findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const tenant = await manager.getRepository(TenantEntity).findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const normalizedAssets = dto.assets.map((asset) => ({
      symbol: asset.symbol.toUpperCase(),
      weight: asset.weight,
      quantity: asset.quantity ?? 0,
    }));

    const weightSum = decimalSum(normalizedAssets.map((asset) => asset.weight));
    if (weightSum.minus(1).abs().greaterThan(decimal('0.0000000001'))) {
      throw new BadRequestException('Portfolio weights must sum to 1.0');
    }

    const portfolio = manager.getRepository(PortfolioEntity).create({
      name: dto.name,
      user,
      tenant,
      assets: normalizedAssets.map((asset) => ({
        symbol: asset.symbol,
        weight: toNumericString(asset.weight),
        quantity: toNumericString(asset.quantity),
      })),
    });

    const saved = await manager.getRepository(PortfolioEntity).save(portfolio);

    return this.toPortfolioResponse(saved);
    });
  }

  async listPortfolios(userId: string, tenantId: string) {
    return this.withTenant(tenantId, async (manager) => {
    const portfolios = await manager.getRepository(PortfolioEntity).find({
      where: { user: { id: userId }, tenant: { id: tenantId } },
      relations: { tenant: true },
      order: { updatedAt: 'DESC' },
    });

    return portfolios.map((portfolio) => this.toPortfolioResponse(portfolio));
    });
  }

  async listTenantPortfolios(tenantId: string) {
    return this.withTenant(tenantId, async (manager) => {
    const portfolios = await manager.getRepository(PortfolioEntity).find({
      where: { tenant: { id: tenantId } },
      relations: { tenant: true },
      order: { updatedAt: 'DESC' },
      take: 100,
    });

    return portfolios.map((portfolio) => this.toPortfolioResponse(portfolio));
    });
  }

  async getPortfolioResponse(id: string, userId: string, tenantId: string) {
    return this.toPortfolioResponse(await this.getPortfolioById(id, userId, tenantId));
  }

  async getPortfolioById(id: string, userId: string, tenantId: string) {
    return this.withTenant(tenantId, async (manager) => {
    const portfolio = await manager.getRepository(PortfolioEntity).findOne({
      where: { id, user: { id: userId }, tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${id} not found`);
    }

    return portfolio;
    });
  }

  private async withTenant<T>(tenantId: string, work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return work(manager);
    });
  }

  private toPortfolioResponse(portfolio: PortfolioEntity) {
    return {
      id: portfolio.id,
      tenantId: portfolio.tenant.id,
      name: portfolio.name,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      assets: portfolio.assets.map((asset) => ({
        symbol: asset.symbol,
        weight: Number(asset.weight),
        quantity: Number(asset.quantity),
      })),
    };
  }
}

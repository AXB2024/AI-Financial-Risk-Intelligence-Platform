import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { PortfolioEntity } from '../entities/portfolio.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioEntity)
    private readonly portfolioRepository: Repository<PortfolioEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  async createPortfolio(dto: CreatePortfolioDto, userId: string, tenantId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const normalizedAssets = dto.assets.map((asset) => ({
      symbol: asset.symbol.toUpperCase(),
      weight: asset.weight,
      quantity: asset.quantity ?? 0,
    }));

    const weightSum = normalizedAssets.reduce((sum, asset) => sum + asset.weight, 0);
    if (Math.abs(weightSum - 1) > 0.0001) {
      throw new BadRequestException('Portfolio weights must sum to 1.0');
    }

    const portfolio = this.portfolioRepository.create({
      name: dto.name,
      user,
      tenant,
      assets: normalizedAssets.map((asset) => ({
        symbol: asset.symbol,
        weight: asset.weight.toFixed(6),
        quantity: asset.quantity.toFixed(2),
      })),
    });

    const saved = await this.portfolioRepository.save(portfolio);

    return this.toPortfolioResponse(saved);
  }

  async listPortfolios(userId: string, tenantId: string) {
    const portfolios = await this.portfolioRepository.find({
      where: { user: { id: userId }, tenant: { id: tenantId } },
      relations: { tenant: true },
      order: { updatedAt: 'DESC' },
    });

    return portfolios.map((portfolio) => this.toPortfolioResponse(portfolio));
  }

  async listTenantPortfolios(tenantId: string) {
    const portfolios = await this.portfolioRepository.find({
      where: { tenant: { id: tenantId } },
      relations: { tenant: true },
      order: { updatedAt: 'DESC' },
      take: 100,
    });

    return portfolios.map((portfolio) => this.toPortfolioResponse(portfolio));
  }

  async getPortfolioResponse(id: string, userId: string, tenantId: string) {
    return this.toPortfolioResponse(await this.getPortfolioById(id, userId, tenantId));
  }

  async getPortfolioById(id: string, userId: string, tenantId: string) {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id, user: { id: userId }, tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${id} not found`);
    }

    return portfolio;
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

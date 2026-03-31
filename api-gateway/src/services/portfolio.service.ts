import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { PortfolioEntity } from '../entities/portfolio.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioEntity)
    private readonly portfolioRepository: Repository<PortfolioEntity>,
  ) {}

  async createPortfolio(dto: CreatePortfolioDto) {
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
      assets: normalizedAssets.map((asset) => ({
        symbol: asset.symbol,
        weight: asset.weight.toFixed(6),
        quantity: asset.quantity.toFixed(2),
      })),
    });

    const saved = await this.portfolioRepository.save(portfolio);

    return {
      id: saved.id,
      name: saved.name,
      createdAt: saved.createdAt,
      assets: saved.assets.map((asset) => ({
        symbol: asset.symbol,
        weight: Number(asset.weight),
        quantity: Number(asset.quantity),
      })),
    };
  }

  async getPortfolioById(id: string) {
    const portfolio = await this.portfolioRepository.findOne({ where: { id } });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${id} not found`);
    }

    return portfolio;
  }
}

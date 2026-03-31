import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PortfolioAssetEntity } from './portfolio-asset.entity';
import { RiskResultEntity } from './risk-result.entity';

@Entity({ name: 'portfolios' })
export class PortfolioEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => PortfolioAssetEntity, (asset) => asset.portfolio, {
    cascade: true,
    eager: true,
  })
  assets!: PortfolioAssetEntity[];

  @OneToMany(() => RiskResultEntity, (result) => result.portfolio)
  riskResults!: RiskResultEntity[];
}

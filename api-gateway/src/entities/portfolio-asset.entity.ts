import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';

@Entity({ name: 'portfolio_assets' })
export class PortfolioAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 10 })
  symbol!: string;

  @Column('decimal', { precision: 10, scale: 6 })
  weight!: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  quantity!: string;

  @ManyToOne(() => PortfolioEntity, (portfolio) => portfolio.assets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: PortfolioEntity;
}

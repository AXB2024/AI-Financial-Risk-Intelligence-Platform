import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PortfolioAssetEntity } from './portfolio-asset.entity';
import { RiskResultEntity } from './risk-result.entity';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'portfolios' })
export class PortfolioEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @ManyToOne(() => UserEntity, (user) => user.portfolios, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => TenantEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PortfolioAssetEntity, (asset) => asset.portfolio, {
    cascade: true,
    eager: true,
  })
  assets!: PortfolioAssetEntity[];

  @OneToMany(() => RiskResultEntity, (result) => result.portfolio)
  riskResults!: RiskResultEntity[];
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';
import { TenantEntity } from './tenant.entity';

export type RiskResultStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Entity({ name: 'risk_results' })
export class RiskResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => PortfolioEntity, (portfolio) => portfolio.riskResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: PortfolioEntity;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: RiskResultStatus;

  @Column({ name: 'job_id', type: 'varchar', length: 120, nullable: true })
  jobId!: string | null;

  @Column('decimal', { precision: 28, scale: 10, name: 'var_95', nullable: true })
  var95!: string | null;

  @Column('decimal', { precision: 28, scale: 10, nullable: true })
  volatility!: string | null;

  @Column('decimal', { precision: 28, scale: 10, name: 'expected_shortfall', nullable: true })
  expectedShortfall!: string | null;

  @Column('decimal', { precision: 28, scale: 10, name: 'portfolio_value', nullable: true })
  portfolioValue!: string | null;

  @Column('decimal', { precision: 28, scale: 10, name: 'anomaly_score', nullable: true })
  anomalyScore!: string | null;

  @Column({ name: 'anomaly_z_score', type: 'decimal', precision: 28, scale: 10, nullable: true })
  anomalyZScore!: string | null;

  @Column({ name: 'anomaly_detected', type: 'boolean', nullable: true })
  anomalyDetected!: boolean | null;

  @Column({ type: 'jsonb', name: 'sentiment_json', nullable: true })
  sentimentJson!: unknown | null;

  @Column({ type: 'jsonb', name: 'composition_json', nullable: true })
  compositionJson!: unknown | null;

  @Column({ type: 'jsonb', name: 'timeseries_json', nullable: true })
  timeseriesJson!: unknown | null;

  @Column({ type: 'jsonb', name: 'premium_analytics_json', nullable: true })
  premiumAnalyticsJson!: unknown | null;

  @Column({ name: 'input_hash', type: 'varchar', length: 64, nullable: true })
  inputHash!: string | null;

  @Column({ name: 'model_version', type: 'varchar', length: 80, default: 'phase2-local-ml' })
  modelVersion!: string;

  @Column({ name: 'var_method', type: 'varchar', length: 40, default: 'historical' })
  varMethod!: string;

  @Column({ type: 'jsonb', name: 'model_config_json', nullable: true })
  modelConfigJson!: unknown | null;

  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt!: Date | null;
}

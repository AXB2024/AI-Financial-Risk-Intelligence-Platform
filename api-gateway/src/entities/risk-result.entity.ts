import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';

@Entity({ name: 'risk_results' })
export class RiskResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => PortfolioEntity, (portfolio) => portfolio.riskResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: PortfolioEntity;

  @Column('decimal', { precision: 10, scale: 6, name: 'var_95' })
  var95!: string;

  @Column('decimal', { precision: 10, scale: 6 })
  volatility!: string;

  @Column('decimal', { precision: 10, scale: 6, name: 'anomaly_score' })
  anomalyScore!: string;

  @Column({ name: 'anomaly_detected', type: 'boolean' })
  anomalyDetected!: boolean;

  @Column({ type: 'jsonb', name: 'sentiment_json' })
  sentimentJson!: unknown;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt!: Date;
}

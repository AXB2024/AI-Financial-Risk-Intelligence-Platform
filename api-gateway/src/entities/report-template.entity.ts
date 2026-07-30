import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TenantEntity } from './tenant.entity';

@Entity({ name: 'report_templates' })
export class ReportTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ length: 160 })
  name!: string;

  @Column({ length: 80 })
  type!: 'risk_summary' | 'tail_risk' | 'backtest' | 'audit';

  @Column({ name: 'config_json', type: 'jsonb', default: {} })
  configJson!: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

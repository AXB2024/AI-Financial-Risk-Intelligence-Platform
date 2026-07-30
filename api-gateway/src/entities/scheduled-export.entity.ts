import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ReportTemplateEntity } from './report-template.entity';
import { TenantEntity } from './tenant.entity';

@Entity({ name: 'scheduled_exports' })
export class ScheduledExportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @ManyToOne(() => ReportTemplateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_template_id' })
  reportTemplate!: ReportTemplateEntity;

  @Column({ length: 40 })
  cadence!: 'daily' | 'weekly' | 'monthly';

  @Column({ name: 'destination_type', length: 40 })
  destinationType!: 'email' | 's3' | 'webhook' | 'crm';

  @Column({ name: 'destination_config', type: 'jsonb', default: {} })
  destinationConfig!: unknown;

  @Column({ name: 'next_run_at', type: 'timestamp', nullable: true })
  nextRunAt!: Date | null;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

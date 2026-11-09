import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ReconciliationBreakEntity } from './reconciliation-break.entity';
import { TenantEntity } from './tenant.entity';

@Entity({ name: 'reconciliation_runs' })
@Index(['tenant', 'asOfDate'])
export class ReconciliationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'source', type: 'varchar', length: 60, default: 'ibkr_flex' })
  source!: string;

  @Column({ name: 'external_account_id', type: 'varchar', length: 120, nullable: true })
  externalAccountId!: string | null;

  @Column({ name: 'as_of_date', type: 'date' })
  asOfDate!: string;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'completed' })
  status!: 'completed' | 'completed_with_breaks';

  @Column({ name: 'break_count', type: 'integer', default: 0 })
  breakCount!: number;

  @OneToMany(() => ReconciliationBreakEntity, (item) => item.reconciliationRun)
  breaks!: ReconciliationBreakEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

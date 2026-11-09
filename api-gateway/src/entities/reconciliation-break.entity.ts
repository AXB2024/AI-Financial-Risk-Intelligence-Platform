import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ReconciliationRunEntity } from './reconciliation-run.entity';
import { SecurityMasterEntity } from './security-master.entity';
import { TenantEntity } from './tenant.entity';

export type ReconciliationBreakStatus = 'open' | 'assigned' | 'resolved' | 'ignored';

@Entity({ name: 'reconciliation_breaks' })
@Index(['tenant', 'status', 'breakType'])
export class ReconciliationBreakEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @ManyToOne(() => ReconciliationRunEntity, (run) => run.breaks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reconciliation_run_id' })
  reconciliationRun!: ReconciliationRunEntity;

  @ManyToOne(() => SecurityMasterEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'security_id' })
  security!: SecurityMasterEntity | null;

  @Column({ name: 'break_type', type: 'varchar', length: 50 })
  breakType!: 'quantity_break' | 'missing_internal_position' | 'missing_custodian_position' | 'unmapped_security';

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'open' })
  status!: ReconciliationBreakStatus;

  @Column({ name: 'symbol', type: 'varchar', length: 32, nullable: true })
  symbol!: string | null;

  @Column({ name: 'internal_quantity', type: 'decimal', precision: 28, scale: 10, nullable: true })
  internalQuantity!: string | null;

  @Column({ name: 'custodian_quantity', type: 'decimal', precision: 28, scale: 10, nullable: true })
  custodianQuantity!: string | null;

  @Column({ name: 'difference_quantity', type: 'decimal', precision: 28, scale: 10, nullable: true })
  differenceQuantity!: string | null;

  @Column({ name: 'assigned_to', type: 'varchar', length: 160, nullable: true })
  assignedTo!: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  @Column({ type: 'jsonb', name: 'metadata_json', nullable: true })
  metadataJson!: unknown | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

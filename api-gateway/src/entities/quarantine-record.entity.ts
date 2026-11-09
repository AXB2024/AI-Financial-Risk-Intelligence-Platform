import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { IngestionRunEntity } from './ingestion-run.entity';
import { TenantEntity } from './tenant.entity';

export type QuarantineReason = 'unmapped_security' | 'missing_price' | 'stale_price' | 'invalid_record';
export type QuarantineStatus = 'open' | 'resolved' | 'ignored';

@Entity({ name: 'quarantine_records' })
@Index(['tenant', 'status', 'reason'])
export class QuarantineRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @ManyToOne(() => IngestionRunEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ingestion_run_id' })
  ingestionRun!: IngestionRunEntity | null;

  @Column({ name: 'reason', type: 'varchar', length: 40 })
  reason!: QuarantineReason;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'open' })
  status!: QuarantineStatus;

  @Column({ name: 'source', type: 'varchar', length: 60 })
  source!: string;

  @Column({ name: 'source_record_id', type: 'varchar', length: 180, nullable: true })
  sourceRecordId!: string | null;

  @Column({ name: 'symbol', type: 'varchar', length: 32, nullable: true })
  symbol!: string | null;

  @Column({ name: 'message', type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', name: 'raw_json', nullable: true })
  rawJson!: unknown | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

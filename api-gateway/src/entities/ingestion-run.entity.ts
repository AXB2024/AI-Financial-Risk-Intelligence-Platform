import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TenantEntity } from './tenant.entity';

export type IngestionRunStatus = 'completed' | 'completed_with_quarantine' | 'failed';

@Entity({ name: 'ingestion_runs' })
@Index(['tenant', 'source', 'sourceFileHash'], { unique: true })
export class IngestionRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'source', type: 'varchar', length: 60 })
  source!: string;

  @Column({ name: 'source_file_hash', type: 'varchar', length: 64 })
  sourceFileHash!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 140 })
  idempotencyKey!: string;

  @Column({ name: 'status', type: 'varchar', length: 40 })
  status!: IngestionRunStatus;

  @Column({ name: 'positions_inserted', type: 'integer', default: 0 })
  positionsInserted!: number;

  @Column({ name: 'transactions_inserted', type: 'integer', default: 0 })
  transactionsInserted!: number;

  @Column({ name: 'duplicates_skipped', type: 'integer', default: 0 })
  duplicatesSkipped!: number;

  @Column({ name: 'quarantined_records', type: 'integer', default: 0 })
  quarantinedRecords!: number;

  @Column({ type: 'jsonb', name: 'metadata_json', nullable: true })
  metadataJson!: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SecurityMasterEntity } from './security-master.entity';
import { TenantEntity } from './tenant.entity';

@Entity({ name: 'position_ledger' })
@Index(['tenant', 'custodian', 'externalAccountId', 'validFrom'])
@Index(['naturalKeyHash'], { unique: true })
export class PositionLedgerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @ManyToOne(() => SecurityMasterEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'security_id' })
  security!: SecurityMasterEntity | null;

  @Column({ name: 'custodian', type: 'varchar', length: 40 })
  custodian!: string;

  @Column({ name: 'external_account_id', type: 'varchar', length: 120 })
  externalAccountId!: string;

  @Column({ name: 'source_record_id', type: 'varchar', length: 180 })
  sourceRecordId!: string;

  @Column({ name: 'source_file_hash', type: 'varchar', length: 64 })
  sourceFileHash!: string;

  @Column({ name: 'natural_key_hash', type: 'varchar', length: 64 })
  naturalKeyHash!: string;

  @Column({ name: 'symbol', type: 'varchar', length: 32, nullable: true })
  symbol!: string | null;

  @Column({ name: 'quantity', type: 'decimal', precision: 28, scale: 10 })
  quantity!: string;

  @Column({ name: 'market_value', type: 'decimal', precision: 28, scale: 10, nullable: true })
  marketValue!: string | null;

  @Column({ name: 'currency', type: 'varchar', length: 8, nullable: true })
  currency!: string | null;

  @Column({ name: 'valid_from', type: 'timestamp' })
  validFrom!: Date;

  @Column({ name: 'valid_to', type: 'timestamp', nullable: true })
  validTo!: Date | null;

  @Column({ name: 'system_from', type: 'timestamp' })
  systemFrom!: Date;

  @Column({ name: 'system_to', type: 'timestamp', nullable: true })
  systemTo!: Date | null;

  @Column({ type: 'jsonb', name: 'raw_json', nullable: true })
  rawJson!: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

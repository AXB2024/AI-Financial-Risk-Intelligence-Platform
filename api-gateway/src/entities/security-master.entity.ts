import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'security_master' })
export class SecurityMasterEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'ticker', type: 'varchar', length: 32, nullable: true })
  ticker!: string | null;

  @Index()
  @Column({ name: 'cusip', type: 'varchar', length: 16, nullable: true })
  cusip!: string | null;

  @Index()
  @Column({ name: 'isin', type: 'varchar', length: 16, nullable: true })
  isin!: string | null;

  @Index()
  @Column({ name: 'sedol', type: 'varchar', length: 16, nullable: true })
  sedol!: string | null;

  @Index({ unique: true, where: 'figi IS NOT NULL' })
  @Column({ name: 'figi', type: 'varchar', length: 32, nullable: true })
  figi!: string | null;

  @Index()
  @Column({ name: 'composite_figi', type: 'varchar', length: 32, nullable: true })
  compositeFigi!: string | null;

  @Column({ name: 'name', type: 'varchar', length: 240, nullable: true })
  name!: string | null;

  @Column({ name: 'security_type', type: 'varchar', length: 80, nullable: true })
  securityType!: string | null;

  @Column({ name: 'exchange_code', type: 'varchar', length: 32, nullable: true })
  exchangeCode!: string | null;

  @Column({ name: 'currency', type: 'varchar', length: 8, nullable: true })
  currency!: string | null;

  @Column({ name: 'resolution_source', type: 'varchar', length: 80, default: 'openfigi' })
  resolutionSource!: string;

  @Column({ type: 'jsonb', name: 'raw_json', nullable: true })
  rawJson!: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

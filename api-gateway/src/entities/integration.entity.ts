import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TenantEntity } from './tenant.entity';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

@Entity({ name: 'integrations' })
export class IntegrationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ length: 80 })
  provider!: string;

  @Column({ length: 80 })
  category!: 'brokerage' | 'crm' | 'storage' | 'webhook';

  @Column({ type: 'varchar', length: 40, default: 'disconnected' })
  status!: IntegrationStatus;

  @Column({ name: 'external_account_id', type: 'text', nullable: true })
  externalAccountId!: string | null;

  @Column({ name: 'metadata_json', type: 'jsonb', nullable: true })
  metadataJson!: unknown | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

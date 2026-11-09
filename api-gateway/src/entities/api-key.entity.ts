import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'api_keys' })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: UserEntity | null;

  @Column({ length: 120 })
  name!: string;

  @Column({ name: 'key_hash', unique: true, length: 255 })
  keyHash!: string;

  @Column({ name: 'key_prefix', length: 16 })
  keyPrefix!: string;

  @Column({ name: 'key_last_four', type: 'varchar', length: 4, nullable: true })
  keyLastFour!: string | null;

  @Column({ type: 'jsonb' })
  scopes!: string[];

  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 120 })
  rateLimitPerMinute!: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId!: string | null;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId!: string | null;

  @Column({ name: 'api_key_id', type: 'varchar', length: 36, nullable: true })
  apiKeyId!: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'user' })
  actorType!: 'user' | 'api_key' | 'system';

  @Column({ length: 12 })
  method!: string;

  @Column({ type: 'text' })
  path!: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode!: number;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 80, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

export type TenantRole = 'owner' | 'admin' | 'analyst' | 'viewer' | 'developer';

@Entity({ name: 'tenant_memberships' })
@Unique(['tenant', 'user'])
export class TenantMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TenantEntity, (tenant) => tenant.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @ManyToOne(() => UserEntity, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 40 })
  role!: TenantRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantMembershipEntity } from './tenant-membership.entity';

export type TenantPlan = 'starter' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended';

@Entity({ name: 'tenants' })
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  name!: string;

  @Column({ unique: true, length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 40, default: 'starter' })
  plan!: TenantPlan;

  @Column({ type: 'varchar', length: 40, default: 'active' })
  status!: TenantStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TenantMembershipEntity, (membership) => membership.tenant)
  memberships!: TenantMembershipEntity[];
}

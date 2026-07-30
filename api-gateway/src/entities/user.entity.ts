import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';
import { TenantMembershipEntity } from './tenant-membership.entity';

export type UserTier = 'free' | 'pro' | 'team' | 'admin';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  tier!: UserTier;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @OneToMany(() => PortfolioEntity, (portfolio) => portfolio.user)
  portfolios!: PortfolioEntity[];

  @OneToMany(() => TenantMembershipEntity, (membership) => membership.user)
  memberships!: TenantMembershipEntity[];
}

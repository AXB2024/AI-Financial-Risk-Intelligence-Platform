import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from './tenant.entity';

@Entity({ name: 'tenant_branding' })
export class TenantBrandingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'primary_color', length: 20, default: '#0f6cbd' })
  primaryColor!: string;

  @Column({ name: 'secondary_color', length: 20, default: '#178a55' })
  secondaryColor!: string;

  @Column({ name: 'custom_domain', type: 'varchar', length: 255, nullable: true })
  customDomain!: string | null;

  @Column({ name: 'support_email', type: 'varchar', length: 255, nullable: true })
  supportEmail!: string | null;

  @Column({ name: 'legal_disclaimer', type: 'text', nullable: true })
  legalDisclaimer!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

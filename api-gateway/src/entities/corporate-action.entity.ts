import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SecurityMasterEntity } from './security-master.entity';

@Entity({ name: 'corporate_actions' })
@Index(['security', 'actionType', 'exDate'])
export class CorporateActionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SecurityMasterEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'security_id' })
  security!: SecurityMasterEntity | null;

  @Column({ name: 'action_type', type: 'varchar', length: 40 })
  actionType!: 'split' | 'dividend' | 'spinoff' | 'merger' | 'symbol_change';

  @Column({ name: 'ex_date', type: 'date' })
  exDate!: string;

  @Column({ name: 'pay_date', type: 'date', nullable: true })
  payDate!: string | null;

  @Column({ name: 'ratio', type: 'decimal', precision: 28, scale: 10, nullable: true })
  ratio!: string | null;

  @Column({ name: 'cash_amount', type: 'decimal', precision: 28, scale: 10, nullable: true })
  cashAmount!: string | null;

  @Column({ name: 'from_symbol', type: 'varchar', length: 32, nullable: true })
  fromSymbol!: string | null;

  @Column({ name: 'to_symbol', type: 'varchar', length: 32, nullable: true })
  toSymbol!: string | null;

  @Column({ name: 'source', type: 'varchar', length: 80, default: 'manual' })
  source!: string;

  @Column({ type: 'jsonb', name: 'raw_json', nullable: true })
  rawJson!: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

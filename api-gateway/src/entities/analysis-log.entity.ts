import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'analysis_logs' })
export class AnalysisLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'portfolio_id', type: 'varchar', length: 36, nullable: true })
  portfolioId!: string | null;

  @Column({ length: 20 })
  level!: 'INFO' | 'WARN' | 'ERROR';

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

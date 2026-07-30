import { IsUUID } from 'class-validator';

export class CreateAnalysisDto {
  @IsUUID()
  portfolioId!: string;
}

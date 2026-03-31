import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisLogEntity } from '../entities/analysis-log.entity';

@Injectable()
export class LoggingService {
  constructor(
    @InjectRepository(AnalysisLogEntity)
    private readonly logRepository: Repository<AnalysisLogEntity>,
  ) {}

  async info(message: string, portfolioId?: string) {
    await this.write('INFO', message, portfolioId);
  }

  async error(message: string, portfolioId?: string) {
    await this.write('ERROR', message, portfolioId);
  }

  private async write(
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    portfolioId?: string,
  ) {
    try {
      const log = this.logRepository.create({
        level,
        message,
        portfolioId: portfolioId ?? null,
      });
      await this.logRepository.save(log);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist analysis log', error);
    }
  }
}

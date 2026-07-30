import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';

interface AuditLogInput {
  userId: string | null;
  tenantId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async record(input: AuditLogInput): Promise<void> {
    try {
      await this.auditLogRepository.save(this.auditLogRepository.create(input));
    } catch (error) {
      this.logger.warn(`Failed to write audit log: ${error instanceof Error ? error.message : error}`);
    }
  }
}

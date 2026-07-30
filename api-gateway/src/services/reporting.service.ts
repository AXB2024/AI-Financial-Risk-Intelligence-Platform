import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReportTemplateDto, CreateScheduledExportDto } from '../dto/reporting.dto';
import { ReportTemplateEntity } from '../entities/report-template.entity';
import { ScheduledExportEntity } from '../entities/scheduled-export.entity';
import { TenantRole } from '../entities/tenant-membership.entity';
import { TenantEntity } from '../entities/tenant.entity';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(ReportTemplateEntity)
    private readonly reportTemplateRepository: Repository<ReportTemplateEntity>,
    @InjectRepository(ScheduledExportEntity)
    private readonly scheduledExportRepository: Repository<ScheduledExportEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  async createTemplate(tenantId: string, role: TenantRole, dto: CreateReportTemplateDto) {
    this.requireAnalyst(role);
    const tenant = await this.getTenant(tenantId);
    return this.reportTemplateRepository.save(
      this.reportTemplateRepository.create({
        tenant,
        name: dto.name,
        type: dto.type,
        configJson: dto.configJson ?? {},
      }),
    );
  }

  async listTemplates(tenantId: string) {
    return this.reportTemplateRepository.find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
    });
  }

  async createSchedule(tenantId: string, role: TenantRole, dto: CreateScheduledExportDto) {
    this.requireAnalyst(role);
    const tenant = await this.getTenant(tenantId);
    const template = await this.reportTemplateRepository.findOne({
      where: { id: dto.reportTemplateId, tenant: { id: tenantId } },
    });
    if (!template) {
      throw new NotFoundException('Report template not found');
    }

    return this.scheduledExportRepository.save(
      this.scheduledExportRepository.create({
        tenant,
        reportTemplate: template,
        cadence: dto.cadence,
        destinationType: dto.destinationType,
        destinationConfig: dto.destinationConfig ?? {},
        nextRunAt: this.nextRun(dto.cadence),
        enabled: true,
      }),
    );
  }

  async listSchedules(tenantId: string) {
    return this.scheduledExportRepository.find({
      where: { tenant: { id: tenantId } },
      relations: { reportTemplate: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async getTenant(tenantId: string) {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private requireAnalyst(role: TenantRole) {
    if (!['owner', 'admin', 'analyst'].includes(role)) {
      throw new ForbiddenException('Analyst access required');
    }
  }

  private nextRun(cadence: 'daily' | 'weekly' | 'monthly') {
    const next = new Date();
    if (cadence === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (cadence === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }
}

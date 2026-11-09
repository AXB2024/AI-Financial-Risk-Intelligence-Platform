import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  async createTemplate(tenantId: string, role: TenantRole, dto: CreateReportTemplateDto) {
    this.requireAnalyst(role);
    return this.withTenant(tenantId, async (manager) => {
    const tenant = await this.getTenant(tenantId, manager);
    return manager.getRepository(ReportTemplateEntity).save(
      manager.getRepository(ReportTemplateEntity).create({
        tenant,
        name: dto.name,
        type: dto.type,
        configJson: dto.configJson ?? {},
      }),
    );
    });
  }

  async listTemplates(tenantId: string) {
    return this.withTenant(tenantId, (manager) => manager.getRepository(ReportTemplateEntity).find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
    }));
  }

  async createSchedule(tenantId: string, role: TenantRole, dto: CreateScheduledExportDto) {
    this.requireAnalyst(role);
    return this.withTenant(tenantId, async (manager) => {
    const tenant = await this.getTenant(tenantId, manager);
    const template = await manager.getRepository(ReportTemplateEntity).findOne({
      where: { id: dto.reportTemplateId, tenant: { id: tenantId } },
    });
    if (!template) {
      throw new NotFoundException('Report template not found');
    }

    return manager.getRepository(ScheduledExportEntity).save(
      manager.getRepository(ScheduledExportEntity).create({
        tenant,
        reportTemplate: template,
        cadence: dto.cadence,
        destinationType: dto.destinationType,
        destinationConfig: dto.destinationConfig ?? {},
        nextRunAt: this.nextRun(dto.cadence),
        enabled: true,
      }),
    );
    });
  }

  async listSchedules(tenantId: string) {
    return this.withTenant(tenantId, (manager) => manager.getRepository(ScheduledExportEntity).find({
      where: { tenant: { id: tenantId } },
      relations: { reportTemplate: true },
      order: { createdAt: 'DESC' },
    }));
  }

  private async getTenant(tenantId: string, manager: EntityManager) {
    const tenant = await manager.getRepository(TenantEntity).findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private async withTenant<T>(tenantId: string, work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return work(manager);
    });
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

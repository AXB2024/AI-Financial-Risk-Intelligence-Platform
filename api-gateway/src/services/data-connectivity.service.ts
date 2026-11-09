import { createHash } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { XMLParser } from 'fast-xml-parser';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  IngestIbkrFlexDto,
  PositionSnapshotQueryDto,
  ReconciliationRunDto,
  CreateCorporateActionDto,
  UpdateBreakDto,
  UpdateQuarantineDto,
} from '../dto/data-connectivity.dto';
import { CorporateActionEntity } from '../entities/corporate-action.entity';
import { IngestionRunEntity } from '../entities/ingestion-run.entity';
import { PortfolioEntity } from '../entities/portfolio.entity';
import { PositionLedgerEntity } from '../entities/position-ledger.entity';
import { QuarantineRecordEntity } from '../entities/quarantine-record.entity';
import { ReconciliationBreakEntity } from '../entities/reconciliation-break.entity';
import { ReconciliationRunEntity } from '../entities/reconciliation-run.entity';
import { SecurityMasterEntity } from '../entities/security-master.entity';
import { TenantRole } from '../entities/tenant-membership.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { TransactionLedgerEntity } from '../entities/transaction-ledger.entity';
import { SecurityMasterService } from './security-master.service';
import { decimal, toNumericString } from '../utils/round.util';

interface ParsedIbkrRecord {
  sourceRecordId: string;
  externalAccountId: string;
  symbol: string | null;
  cusip?: string;
  isin?: string;
  figi?: string;
  quantity?: number;
  marketValue?: number;
  amount?: number;
  currency?: string;
  transactionType?: string;
  validAt: Date;
  raw: Record<string, unknown>;
}

@Injectable()
export class DataConnectivityService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    trimValues: true,
  });

  constructor(
    private readonly securityMasterService: SecurityMasterService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(IngestionRunEntity)
    private readonly ingestionRunRepository: Repository<IngestionRunEntity>,
    @InjectRepository(PositionLedgerEntity)
    private readonly positionRepository: Repository<PositionLedgerEntity>,
    @InjectRepository(TransactionLedgerEntity)
    private readonly transactionRepository: Repository<TransactionLedgerEntity>,
    @InjectRepository(QuarantineRecordEntity)
    private readonly quarantineRepository: Repository<QuarantineRecordEntity>,
    @InjectRepository(ReconciliationRunEntity)
    private readonly reconciliationRunRepository: Repository<ReconciliationRunEntity>,
    @InjectRepository(ReconciliationBreakEntity)
    private readonly reconciliationBreakRepository: Repository<ReconciliationBreakEntity>,
    @InjectRepository(CorporateActionEntity)
    private readonly corporateActionRepository: Repository<CorporateActionEntity>,
    @InjectRepository(SecurityMasterEntity)
    private readonly securityRepository: Repository<SecurityMasterEntity>,
    @InjectRepository(PortfolioEntity)
    private readonly portfolioRepository: Repository<PortfolioEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async ingestIbkrFlex(tenantId: string, role: TenantRole, dto: IngestIbkrFlexDto) {
    this.requireAnalyst(role);
    return this.withTenant(tenantId, async (manager) => {
    const tenant = await this.requireTenant(tenantId, manager);
    const sourceFileHash = this.sha256(dto.xml);
    const idempotencyKey = dto.idempotencyKey ?? `ibkr-flex:${sourceFileHash}`;

    const existingRun = await manager.getRepository(IngestionRunEntity).findOne({
      where: { tenant: { id: tenantId }, source: 'ibkr_flex', sourceFileHash },
    });
    if (existingRun) {
      return {
        ...existingRun,
        replayed: true,
        message: 'File was already ingested; existing idempotent run returned.',
      };
    }

    const parsed = this.parser.parse(dto.xml);
    const { positions, transactions } = this.extractIbkrRecords(parsed, dto.externalAccountId);

    const run = await manager.getRepository(IngestionRunEntity).save(
      manager.getRepository(IngestionRunEntity).create({
        tenant,
        source: 'ibkr_flex',
        sourceFileHash,
        idempotencyKey,
        status: 'completed',
        metadataJson: {
          externalAccountId: dto.externalAccountId ?? null,
          parsedPositions: positions.length,
          parsedTransactions: transactions.length,
        },
      }),
    );

    const systemFrom = new Date();
    let positionsInserted = 0;
    let transactionsInserted = 0;
    let duplicatesSkipped = 0;
    let quarantinedRecords = 0;

    for (const position of positions) {
      const security = await this.resolveOrQuarantine(tenant, run, position, manager);
      if (!security) {
        quarantinedRecords += 1;
        continue;
      }

      const naturalKeyHash = this.sha256(
        ['position', tenantId, 'ibkr_flex', position.externalAccountId, position.sourceRecordId, sourceFileHash].join('|'),
      );
      if (await manager.getRepository(PositionLedgerEntity).findOne({ where: { naturalKeyHash } })) {
        duplicatesSkipped += 1;
        continue;
      }

      await manager.getRepository(PositionLedgerEntity).save(
        manager.getRepository(PositionLedgerEntity).create({
          tenant,
          security,
          custodian: 'ibkr',
          externalAccountId: position.externalAccountId,
          sourceRecordId: position.sourceRecordId,
          sourceFileHash,
          naturalKeyHash,
          symbol: position.symbol,
          quantity: String(position.quantity ?? 0),
          marketValue: position.marketValue === undefined ? null : String(position.marketValue),
          currency: position.currency ?? null,
          validFrom: position.validAt,
          validTo: null,
          systemFrom,
          systemTo: null,
          rawJson: position.raw,
        }),
      );
      positionsInserted += 1;
    }

    for (const transaction of transactions) {
      const security = await this.resolveOrQuarantine(tenant, run, transaction, manager);
      const naturalKeyHash = this.sha256(
        ['transaction', tenantId, 'ibkr_flex', transaction.externalAccountId, transaction.sourceRecordId, sourceFileHash].join('|'),
      );
      if (await manager.getRepository(TransactionLedgerEntity).findOne({ where: { naturalKeyHash } })) {
        duplicatesSkipped += 1;
        continue;
      }

      await manager.getRepository(TransactionLedgerEntity).save(
        manager.getRepository(TransactionLedgerEntity).create({
          tenant,
          security,
          custodian: 'ibkr',
          externalAccountId: transaction.externalAccountId,
          sourceRecordId: transaction.sourceRecordId,
          sourceFileHash,
          naturalKeyHash,
          transactionType: transaction.transactionType ?? 'unknown',
          symbol: transaction.symbol,
          quantity: transaction.quantity === undefined ? null : String(transaction.quantity),
          amount: transaction.amount === undefined ? null : String(transaction.amount),
          currency: transaction.currency ?? null,
          validFrom: transaction.validAt,
          validTo: null,
          systemFrom,
          systemTo: null,
          rawJson: transaction.raw,
        }),
      );
      transactionsInserted += 1;
    }

    await manager.getRepository(IngestionRunEntity).update(run.id, {
      status: quarantinedRecords > 0 ? 'completed_with_quarantine' : 'completed',
      positionsInserted,
      transactionsInserted,
      duplicatesSkipped,
      quarantinedRecords,
    });

    return manager.getRepository(IngestionRunEntity).findOne({ where: { id: run.id } });
    });
  }

  async getPositionSnapshot(tenantId: string, query: PositionSnapshotQueryDto) {
    return this.withTenant(tenantId, async (manager) => {
    const validAt = query.validAt ? new Date(query.validAt) : new Date();
    const systemAt = query.systemAt ? new Date(query.systemAt) : new Date();

    const rows = await manager.getRepository(PositionLedgerEntity)
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.security', 'security')
      .where('position.tenant_id = :tenantId', { tenantId })
      .andWhere('position.valid_from <= :validAt', { validAt })
      .andWhere('(position.valid_to IS NULL OR position.valid_to > :validAt)', { validAt })
      .andWhere('position.system_from <= :systemAt', { systemAt })
      .andWhere('(position.system_to IS NULL OR position.system_to > :systemAt)', { systemAt })
      .andWhere(query.externalAccountId ? 'position.external_account_id = :externalAccountId' : '1=1', {
        externalAccountId: query.externalAccountId,
      })
      .orderBy('position.external_account_id', 'ASC')
      .addOrderBy('position.symbol', 'ASC')
      .getMany();

    return {
      validAt,
      systemAt,
      positions: rows.map((row) => ({
        id: row.id,
        externalAccountId: row.externalAccountId,
        securityId: row.security?.id ?? null,
        figi: row.security?.figi ?? null,
        symbol: row.symbol,
        quantity: Number(row.quantity),
        marketValue: row.marketValue === null ? null : Number(row.marketValue),
        currency: row.currency,
        validFrom: row.validFrom,
        systemFrom: row.systemFrom,
      })),
    };
    });
  }

  async runReconciliation(tenantId: string, role: TenantRole, dto: ReconciliationRunDto) {
    this.requireAnalyst(role);
    return this.withTenant(tenantId, async (manager) => {
    const tenant = await this.requireTenant(tenantId, manager);
    const snapshot = await this.getPositionSnapshot(tenantId, {
      validAt: dto.asOfDate,
      systemAt: new Date().toISOString(),
      externalAccountId: dto.externalAccountId,
    });
    const internal = await this.getInternalPortfolioQuantities(tenantId, manager);

    const run = await manager.getRepository(ReconciliationRunEntity).save(
      manager.getRepository(ReconciliationRunEntity).create({
        tenant,
        source: 'ibkr_flex',
        externalAccountId: dto.externalAccountId ?? null,
        asOfDate: dto.asOfDate.slice(0, 10),
        status: 'completed',
      }),
    );

    const breaks: ReconciliationBreakEntity[] = [];
    const custodianBySymbol = new Map<string, { quantity: number; securityId: string | null }>();
    snapshot.positions.forEach((position) => {
      const key = position.symbol ?? position.figi ?? position.securityId ?? 'UNMAPPED';
      const current = custodianBySymbol.get(key) ?? { quantity: 0, securityId: position.securityId };
      custodianBySymbol.set(key, {
        quantity: decimal(current.quantity).plus(position.quantity).toNumber(),
        securityId: current.securityId ?? position.securityId,
      });
    });

    for (const [symbol, custodian] of custodianBySymbol.entries()) {
      if (symbol === 'UNMAPPED') {
        breaks.push(await this.createBreak(tenant, run, null, 'unmapped_security', symbol, null, custodian.quantity, manager));
        continue;
      }
      const internalQuantity = internal.get(symbol) ?? 0;
      const diff = decimal(internalQuantity).minus(custodian.quantity);
      if (diff.abs().greaterThan('0.0000000001')) {
        breaks.push(
          await this.createBreak(tenant, run, custodian.securityId, 'quantity_break', symbol, internalQuantity, custodian.quantity, manager),
        );
      }
    }

    for (const [symbol, internalQuantity] of internal.entries()) {
      if (!custodianBySymbol.has(symbol)) {
        breaks.push(await this.createBreak(tenant, run, null, 'missing_custodian_position', symbol, internalQuantity, null, manager));
      }
    }

    await manager.getRepository(ReconciliationRunEntity).update(run.id, {
      status: breaks.length > 0 ? 'completed_with_breaks' : 'completed',
      breakCount: breaks.length,
    });

    return manager.getRepository(ReconciliationRunEntity).findOne({
      where: { id: run.id },
      relations: { breaks: true },
    });
    });
  }

  async listBreaks(tenantId: string) {
    return this.withTenant(tenantId, (manager) => manager.getRepository(ReconciliationBreakEntity).find({
      where: { tenant: { id: tenantId } },
      relations: { reconciliationRun: true, security: true },
      order: { createdAt: 'DESC' },
      take: 100,
    }));
  }

  async updateBreak(tenantId: string, role: TenantRole, id: string, dto: UpdateBreakDto) {
    this.requireAnalyst(role);
    return this.withTenant(tenantId, async (manager) => {
    const item = await manager.getRepository(ReconciliationBreakEntity).findOne({ where: { id, tenant: { id: tenantId } } });
    if (!item) {
      throw new NotFoundException('Reconciliation break not found');
    }
    item.status = dto.status;
    item.assignedTo = dto.assignedTo ?? item.assignedTo;
    item.resolutionNote = dto.resolutionNote ?? item.resolutionNote;
    item.resolvedAt = dto.status === 'resolved' ? new Date() : null;
    return manager.getRepository(ReconciliationBreakEntity).save(item);
    });
  }

  async listQuarantine(tenantId: string) {
    return this.withTenant(tenantId, (manager) => manager.getRepository(QuarantineRecordEntity).find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
      take: 100,
    }));
  }

  async updateQuarantine(tenantId: string, role: TenantRole, id: string, dto: UpdateQuarantineDto) {
    this.requireAnalyst(role);
    return this.withTenant(tenantId, async (manager) => {
    const record = await manager.getRepository(QuarantineRecordEntity).findOne({ where: { id, tenant: { id: tenantId } } });
    if (!record) {
      throw new NotFoundException('Quarantine record not found');
    }
    record.status = dto.status;
    record.rawJson = dto.metadata ? { original: record.rawJson, resolution: dto.metadata } : record.rawJson;
    record.resolvedAt = dto.status === 'resolved' ? new Date() : null;
    return manager.getRepository(QuarantineRecordEntity).save(record);
    });
  }

  async listCorporateActions() {
    return this.corporateActionRepository.find({
      relations: { security: true },
      order: { exDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async createCorporateAction(role: TenantRole, dto: CreateCorporateActionDto) {
    this.requireAnalyst(role);
    const security =
      dto.securityId
        ? await this.securityRepository.findOne({ where: { id: dto.securityId } })
        : dto.ticker
          ? await this.securityMasterService.resolveSecurity({ ticker: dto.ticker })
          : null;

    return this.corporateActionRepository.save(
      this.corporateActionRepository.create({
        security,
        actionType: dto.actionType,
        exDate: dto.exDate.slice(0, 10),
        payDate: dto.payDate ? dto.payDate.slice(0, 10) : null,
        ratio: dto.ratio ?? null,
        cashAmount: dto.cashAmount ?? null,
        fromSymbol: dto.fromSymbol?.toUpperCase() ?? null,
        toSymbol: dto.toSymbol?.toUpperCase() ?? null,
        source: 'manual',
        rawJson: dto.rawJson ?? dto,
      }),
    );
  }

  private async resolveOrQuarantine(
    tenant: TenantEntity,
    run: IngestionRunEntity,
    record: ParsedIbkrRecord,
    manager: EntityManager,
  ) {
    const security = await this.securityMasterService.resolveSecurity({
      ticker: record.symbol ?? undefined,
      cusip: record.cusip,
      isin: record.isin,
      figi: record.figi,
    });
    if (security) {
      return security;
    }

    await manager.getRepository(QuarantineRecordEntity).save(
      manager.getRepository(QuarantineRecordEntity).create({
        tenant,
        ingestionRun: run,
        reason: 'unmapped_security',
        status: 'open',
        source: 'ibkr_flex',
        sourceRecordId: record.sourceRecordId,
        symbol: record.symbol,
        message: 'Security could not be resolved through local security master or OpenFIGI.',
        rawJson: record.raw,
      }),
    );
    return null;
  }

  private extractIbkrRecords(parsed: unknown, fallbackAccountId?: string) {
    const root = parsed as Record<string, unknown>;
    const statements = this.asArray(this.deepFind(root, 'FlexStatement'));
    const positions: ParsedIbkrRecord[] = [];
    const transactions: ParsedIbkrRecord[] = [];

    statements.forEach((statement, statementIndex) => {
      const statementObj = statement as Record<string, unknown>;
      const accountId = String(statementObj.accountId ?? fallbackAccountId ?? 'unknown-account');
      const openPositions = this.asArray(this.deepFind(statementObj, 'OpenPosition'));
      const trades = this.asArray(this.deepFind(statementObj, 'Trade'));

      openPositions.forEach((entry, index) => {
        const row = entry as Record<string, unknown>;
        positions.push({
          sourceRecordId: String(row.conid ?? row.assetCategory ?? `${statementIndex}:position:${index}`),
          externalAccountId: accountId,
          symbol: this.cleanSymbol(row.symbol),
          cusip: this.clean(row.cusip),
          isin: this.clean(row.isin),
          figi: this.clean(row.figi),
          quantity: this.toNumber(row.position ?? row.quantity),
          marketValue: this.toNumber(row.positionValue ?? row.marketValue),
          currency: this.clean(row.currency),
          validAt: this.parseIbkrDate(row.reportDate ?? row.dateTime ?? row.date),
          raw: row,
        });
      });

      trades.forEach((entry, index) => {
        const row = entry as Record<string, unknown>;
        transactions.push({
          sourceRecordId: String(row.tradeID ?? row.transactionID ?? row.ibExecID ?? `${statementIndex}:trade:${index}`),
          externalAccountId: accountId,
          symbol: this.cleanSymbol(row.symbol),
          cusip: this.clean(row.cusip),
          isin: this.clean(row.isin),
          figi: this.clean(row.figi),
          quantity: this.toNumber(row.quantity),
          amount: this.toNumber(row.proceeds ?? row.netCash ?? row.amount),
          currency: this.clean(row.currency),
          transactionType: this.clean(row.buySell) ?? this.clean(row.transactionType) ?? 'trade',
          validAt: this.parseIbkrDate(row.tradeDate ?? row.dateTime ?? row.date),
          raw: row,
        });
      });
    });

    return { positions, transactions };
  }

  private async getInternalPortfolioQuantities(tenantId: string, manager: EntityManager) {
    const portfolios = await manager.getRepository(PortfolioEntity).find({
      where: { tenant: { id: tenantId } },
      relations: { assets: true },
    });
    const quantities = new Map<string, number>();
    portfolios.forEach((portfolio) => {
      portfolio.assets.forEach((asset) => {
        quantities.set(asset.symbol, decimal(quantities.get(asset.symbol) ?? 0).plus(asset.quantity).toNumber());
      });
    });
    return quantities;
  }

  private async createBreak(
    tenant: TenantEntity,
    run: ReconciliationRunEntity,
    securityId: string | null,
    breakType: ReconciliationBreakEntity['breakType'],
    symbol: string | null,
    internalQuantity: number | null,
    custodianQuantity: number | null,
    manager: EntityManager,
  ) {
    const security = securityId ? ({ id: securityId } as SecurityMasterEntity) : null;
    const diff =
      internalQuantity === null || custodianQuantity === null
        ? null
        : decimal(internalQuantity).minus(custodianQuantity);

    return manager.getRepository(ReconciliationBreakEntity).save(
      manager.getRepository(ReconciliationBreakEntity).create({
        tenant,
        reconciliationRun: run,
        security,
        breakType,
        status: 'open',
        symbol,
        internalQuantity: internalQuantity === null ? null : toNumericString(internalQuantity),
        custodianQuantity: custodianQuantity === null ? null : toNumericString(custodianQuantity),
        differenceQuantity: diff === null ? null : toNumericString(diff),
        metadataJson: { agingDays: 0 },
      }),
    );
  }

  private deepFind(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    if (record[key] !== undefined) {
      return record[key];
    }
    for (const child of Object.values(record)) {
      const found = this.deepFind(child, key);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  private asArray(value: unknown): unknown[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  private parseIbkrDate(value: unknown): Date {
    const text = String(value ?? '').trim();
    if (/^\d{8}$/.test(text)) {
      return new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00Z`);
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private clean(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text ? text.toUpperCase() : undefined;
  }

  private cleanSymbol(value: unknown): string | null {
    return this.clean(value) ?? null;
  }

  private toNumber(value: unknown): number | undefined {
    const number = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(number) ? number : undefined;
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async requireTenant(tenantId: string, manager: EntityManager) {
    const tenant = await manager.getRepository(TenantEntity).findOne({ where: { id: tenantId } });
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

  private async withTenant<T>(tenantId: string, work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return work(manager);
    });
  }
}

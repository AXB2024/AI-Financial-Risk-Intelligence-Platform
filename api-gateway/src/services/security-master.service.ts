import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ResolveSecurityDto } from '../dto/data-connectivity.dto';
import { SecurityMasterEntity } from '../entities/security-master.entity';

interface OpenFigiMapping {
  figi?: string;
  compositeFIGI?: string;
  ticker?: string;
  name?: string;
  exchCode?: string;
  securityType?: string;
  marketSector?: string;
  securityDescription?: string;
}

@Injectable()
export class SecurityMasterService {
  private readonly openFigiUrl = 'https://api.openfigi.com/v3/mapping';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(SecurityMasterEntity)
    private readonly securityRepository: Repository<SecurityMasterEntity>,
  ) {}

  async resolveSecurity(dto: ResolveSecurityDto): Promise<SecurityMasterEntity | null> {
    const normalized = this.normalizeIdentifiers(dto);
    const local = await this.findLocal(normalized);
    if (local) {
      return local;
    }

    const openFigi = await this.resolveWithOpenFigi(normalized);
    if (!openFigi) {
      return null;
    }

    const existingByFigi = openFigi.figi
      ? await this.securityRepository.findOne({ where: { figi: openFigi.figi } })
      : null;
    if (existingByFigi) {
      return existingByFigi;
    }

    return this.securityRepository.save(
      this.securityRepository.create({
        ticker: openFigi.ticker?.toUpperCase() ?? normalized.ticker ?? null,
        cusip: normalized.cusip ?? null,
        isin: normalized.isin ?? null,
        sedol: normalized.sedol ?? null,
        figi: openFigi.figi ?? normalized.figi ?? null,
        compositeFigi: openFigi.compositeFIGI ?? null,
        name: openFigi.name ?? openFigi.securityDescription ?? null,
        securityType: openFigi.securityType ?? openFigi.marketSector ?? null,
        exchangeCode: openFigi.exchCode ?? null,
        currency: null,
        resolutionSource: 'openfigi',
        rawJson: openFigi,
      }),
    );
  }

  async requireResolvedSecurity(dto: ResolveSecurityDto) {
    const security = await this.resolveSecurity(dto);
    if (!security) {
      throw new BadRequestException('Security could not be resolved');
    }
    return security;
  }

  private async findLocal(dto: ResolveSecurityDto) {
    const candidates: Array<FindOptionsWhere<SecurityMasterEntity> | null> = [
      dto.figi ? { figi: dto.figi } : null,
      dto.isin ? { isin: dto.isin } : null,
      dto.cusip ? { cusip: dto.cusip } : null,
      dto.sedol ? { sedol: dto.sedol } : null,
      dto.ticker ? { ticker: dto.ticker } : null,
    ];

    for (const where of candidates.filter(Boolean) as Array<FindOptionsWhere<SecurityMasterEntity>>) {
      const security = await this.securityRepository.findOne({ where });
      if (security) {
        return security;
      }
    }

    return null;
  }

  private async resolveWithOpenFigi(dto: ResolveSecurityDto): Promise<OpenFigiMapping | null> {
    const request = this.toOpenFigiRequest(dto);
    if (!request) {
      return null;
    }

    const headers: Record<string, string> = {};
    const apiKey = this.configService.get<string>('OPENFIGI_API_KEY');
    if (apiKey) {
      headers['X-OPENFIGI-APIKEY'] = apiKey;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<Array<{ data?: OpenFigiMapping[] }>>(this.openFigiUrl, [request], {
          headers,
          timeout: 6000,
        }),
      );
      return response.data?.[0]?.data?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private toOpenFigiRequest(dto: ResolveSecurityDto) {
    if (dto.figi) {
      return { idType: 'ID_BB_GLOBAL', idValue: dto.figi };
    }
    if (dto.isin) {
      return { idType: 'ID_ISIN', idValue: dto.isin };
    }
    if (dto.cusip) {
      return { idType: 'ID_CUSIP', idValue: dto.cusip };
    }
    if (dto.sedol) {
      return { idType: 'ID_SEDOL', idValue: dto.sedol };
    }
    if (dto.ticker) {
      return { idType: 'TICKER', idValue: dto.ticker };
    }
    return null;
  }

  private normalizeIdentifiers(dto: ResolveSecurityDto): ResolveSecurityDto {
    return {
      ticker: dto.ticker?.trim().toUpperCase(),
      cusip: dto.cusip?.trim().toUpperCase(),
      isin: dto.isin?.trim().toUpperCase(),
      sedol: dto.sedol?.trim().toUpperCase(),
      figi: dto.figi?.trim().toUpperCase(),
    };
  }
}

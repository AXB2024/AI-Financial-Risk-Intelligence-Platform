import { randomBytes, createHash } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { LoginDto, RegisterDto } from '../dto/auth.dto';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { UserEntity } from '../entities/user.entity';
import { TenantService } from './tenant.service';
import { UsersService } from './users.service';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    await this.tenantService.createPersonalTenant(user, dto.name);

    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.markLogin(user);
    return this.buildSession(user);
  }

  async refresh(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existing = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt || existing.replacedByTokenHash) {
      existing.reusedAt = new Date();
      await this.refreshTokenRepository.save(existing);
      await this.userRepository.increment({ id: existing.user.id }, 'tokenVersion', 1);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    existing.revokedAt = new Date();
    const session = await this.buildSession(existing.user, existing.tokenFamily);
    existing.replacedByTokenHash = this.hashToken(session.refreshToken);
    await this.refreshTokenRepository.save(existing);
    return session;
  }

  async logout(rawRefreshToken: string | undefined) {
    if (rawRefreshToken) {
      await this.refreshTokenRepository.update(
        { tokenHash: this.hashToken(rawRefreshToken) },
        { revokedAt: new Date() },
      );
    }
    return { ok: true };
  }

  private async buildSession(user: UserEntity, tokenFamily = randomBytes(24).toString('hex')) {
    const membership = await this.tenantService.getOrCreateDefaultMembership(user);
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      tenantId: membership.tenant.id,
      tenantSlug: membership.tenant.slug,
      tenantRole: membership.role,
    };

    return {
      user: safeUser,
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        tenantId: membership.tenant.id,
        tenantRole: membership.role,
        tokenVersion: user.tokenVersion,
      }, { expiresIn: ACCESS_TOKEN_EXPIRES_IN }),
      refreshToken: await this.createRefreshToken(user, tokenFamily),
    };
  }

  private async createRefreshToken(user: UserEntity, tokenFamily: string) {
    const rawToken = `frp_refresh_${randomBytes(48).toString('hex')}`;
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        user,
        tokenHash: this.hashToken(rawToken),
        tokenFamily,
        expiresAt,
      }),
    );
    return rawToken;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}

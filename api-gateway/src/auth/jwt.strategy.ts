import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../services/users.service';
import { TenantService } from '../services/tenant.service';
import { AuthUser } from './auth-user';

interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  tenantRole: AuthUser['tenantRole'];
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tenantService: TenantService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-only-change-me'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }
    const membership = payload.tenantId
      ? await this.usersService.getTenantMembership(user.id, payload.tenantId)
      : await this.tenantService.getOrCreateDefaultMembership(user);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      tenantId: membership.tenant.id,
      tenantSlug: membership.tenant.slug,
      tenantRole: membership.role,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto } from '../dto/auth.dto';
import { UserEntity } from '../entities/user.entity';
import { TenantService } from './tenant.service';
import { UsersService } from './users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
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

  private async buildSession(user: UserEntity) {
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
      }),
    };
  }
}

import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { TenantMembershipEntity } from '../entities/tenant-membership.entity';

interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TenantMembershipEntity)
    private readonly membershipRepository: Repository<TenantMembershipEntity>,
  ) {}

  async create(input: CreateUserInput): Promise<UserEntity> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account already exists for this email');
    }

    const user = this.userRepository.create({
      email,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      tier: 'free',
    });

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async markLogin(user: UserEntity): Promise<void> {
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
  }

  async getTenantMembership(userId: string, tenantId: string): Promise<TenantMembershipEntity> {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId }, tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (!membership) {
      throw new ConflictException('User is not a member of this tenant');
    }

    return membership;
  }
}

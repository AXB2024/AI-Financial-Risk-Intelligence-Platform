import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface CacheEntry {
  expiresAt: number;
  value: string;
}

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly redis: Redis | null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null;

    if (this.redis) {
      this.redis.on('error', (error) => {
        this.logger.warn(`Redis cache unavailable: ${error.message}`);
      });
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private async get(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') {
          await this.redis.connect();
        }
        return await this.redis.get(key);
      } catch {
        return this.getFromMemory(key);
      }
    }

    return this.getFromMemory(key);
  }

  private async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') {
          await this.redis.connect();
        }
        await this.redis.set(key, value, 'EX', ttlSeconds);
        return;
      } catch {
        this.setInMemory(key, value, ttlSeconds);
        return;
      }
    }

    this.setInMemory(key, value, ttlSeconds);
  }

  private getFromMemory(key: string): string | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setInMemory(key: string, value: string, ttlSeconds: number) {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

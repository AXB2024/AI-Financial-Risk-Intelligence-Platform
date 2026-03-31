import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get<string>('DB_PORT', '5432')),
    username: config.get<string>('DB_USER', 'postgres'),
    password: config.get<string>('DB_PASSWORD', 'postgres'),
    database: config.get<string>('DB_NAME', 'finance_db'),
    autoLoadEntities: true,
    synchronize: config.get<string>('TYPEORM_SYNC', 'true') === 'true',
    logging: config.get<string>('DB_LOGGING', 'true') === 'true' ? ['error', 'warn'] : false,
    retryAttempts: Number(config.get<string>('DB_RETRY_ATTEMPTS', '8')),
    retryDelay: Number(config.get<string>('DB_RETRY_DELAY', '3000')),
    verboseRetryLog: true,
  };
}

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    // Environment switching happens here: localhost for local dev, postgres for Docker.
    return buildTypeOrmOptions(config);
  },
};

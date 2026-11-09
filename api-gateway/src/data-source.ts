import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { buildTypeOrmOptions } from './config/database.config';

loadEnv();

const config = {
  get<T = string>(key: string, defaultValue?: T): T {
    return (process.env[key] ?? defaultValue) as T;
  },
};

const options = buildTypeOrmOptions(config as never);

export default new DataSource({
  ...options,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
} as DataSourceOptions);

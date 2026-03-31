import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseConnectionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseConnectionService.name);

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    if (this.dataSource.isInitialized) {
      const options = this.dataSource.options as { type?: string; host?: string; port?: number };
      this.logger.log(
        `Database connected successfully (${options.type}) at ${String(options.host)}:${String(options.port)}`,
      );
    }
  }
}

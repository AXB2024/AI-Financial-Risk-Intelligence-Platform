import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type JobHandler = () => Promise<void>;

interface QueuedJob {
  id: string;
  handler: JobHandler;
  attempts: number;
}

@Injectable()
export class BackgroundJobService implements OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobService.name);
  private readonly queue: QueuedJob[] = [];
  private readonly maxAttempts: number;
  private activeCount = 0;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {
    this.maxAttempts = Number(this.configService.get<string>('JOB_MAX_ATTEMPTS', '3'));
  }

  enqueue(id: string, handler: JobHandler) {
    this.queue.push({ id, handler, attempts: 0 });
    this.drain();
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
  }

  private drain() {
    if (this.isShuttingDown) {
      return;
    }

    const concurrency = Number(this.configService.get<string>('JOB_WORKER_CONCURRENCY', '2'));

    while (this.activeCount < concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        return;
      }

      this.activeCount += 1;
      void this.run(job);
    }
  }

  private async run(job: QueuedJob) {
    try {
      await job.handler();
    } catch (error) {
      job.attempts += 1;
      if (job.attempts < this.maxAttempts) {
        const backoffMs = 500 * job.attempts;
        this.logger.warn(`Retrying background job ${job.id} after ${backoffMs}ms`);
        setTimeout(() => {
          this.queue.push(job);
          this.drain();
        }, backoffMs);
      } else {
        this.logger.error(`Background job ${job.id} failed after ${job.attempts} attempts`, error);
      }
    } finally {
      this.activeCount -= 1;
      this.drain();
    }
  }
}

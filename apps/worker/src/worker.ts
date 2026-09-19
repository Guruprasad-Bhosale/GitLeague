import { Worker, WorkerOptions } from 'bullmq';
import pino from 'pino';
import { SYNC_QUEUE_NAME, UserSyncJobPayload } from './queues/sync.queue.js';
import { processUserSync } from './processors/sync.processor.js';
import { redisConfig } from './config/redis.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export function createSyncWorker(options?: Partial<WorkerOptions>): Worker<UserSyncJobPayload> {
  const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

  const worker = new Worker<UserSyncJobPayload>(
    SYNC_QUEUE_NAME,
    async (job) => {
      return processUserSync(job);
    },
    {
      connection: redisConfig,
      concurrency,
      limiter: {
        max: 10,
        duration: 1000,
      },
      ...options,
    }
  );

  worker.on('ready', () => {
    logger.info(`⚡ GitLeague Sync Worker is ready (concurrency: ${concurrency})`);
  });

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, userId: job.data.userId, result }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, userId: job?.data?.userId, err: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Worker error encountered');
  });

  return worker;
}

import { Queue, QueueOptions, JobsOptions } from 'bullmq';
import { redisConfig } from '../config/redis.js';

export const SYNC_QUEUE_NAME = 'github-sync';
export const JOB_USER_SYNC = 'github:user-sync';

export interface UserSyncJobPayload {
  userId: string;
  force?: boolean;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
    age: 3600 * 24, // keep for 24h
  },
  removeOnFail: {
    count: 500,
    age: 3600 * 24 * 7, // keep for 7 days
  },
};

export function createSyncQueue(options?: Partial<QueueOptions>): Queue<UserSyncJobPayload> {
  return new Queue<UserSyncJobPayload>(SYNC_QUEUE_NAME, {
    connection: redisConfig,
    defaultJobOptions,
    ...options,
  });
}

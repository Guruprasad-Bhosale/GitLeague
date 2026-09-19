import { RedisOptions } from 'ioredis';
import { workerEnv } from './env.js';

export const redisConfig: RedisOptions = {
  host: workerEnv.REDIS_HOST,
  port: workerEnv.REDIS_PORT,
  password: workerEnv.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
};

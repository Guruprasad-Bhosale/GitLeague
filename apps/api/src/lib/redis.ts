import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
};

let redisClient: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisOptions);

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Connected to Redis Cache');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      logger.warn({ err: err.message }, 'Redis Cache connection warning (falling back to direct DB queries)');
    });
  }
  return redisClient;
}

export function isRedisAvailable(): boolean {
  return isConnected;
}

export class CacheService {
  private static prefix = `gitleague:${env.NODE_ENV}:`;

  private static formatKey(key: string): string {
    return `${CacheService.prefix}${key}`;
  }

  /**
   * Get cached JSON payload by key with graceful fallback on cache failure or malformed data
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const raw = await client.get(this.formatKey(key));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      // Degrade gracefully to direct database query
      return null;
    }
  }

  /**
   * Set cache entry with TTL in seconds (non-blocking, non-fatal)
   */
  static async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      const client = getRedisClient();
      await client.set(this.formatKey(key), JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Non-fatal, continue without cache
    }
  }

  /**
   * Invalidate keys matching pattern (non-blocking, non-fatal)
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const client = getRedisClient();
      const namespacedPattern = this.formatKey(pattern);
      const keys = await client.keys(namespacedPattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Disconnect Redis client cleanly
   */
  static async disconnect(): Promise<void> {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        redisClient.disconnect();
      }
      redisClient = null;
      isConnected = false;
    }
  }
}

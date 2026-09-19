import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env.js';
import { getRedisClient } from '../lib/redis.js';

/**
 * Proxy-aware client IP resolution
 */
export function resolveClientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const raw = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const firstIp = raw.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Factory to create rate limiters with graceful store behavior
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: options.message,
      },
    },
    // Express trust proxy + fallback header extraction handles IP resolution
    keyGenerator: (req) => resolveClientIp(req),
  });
}

// 1. General API rate limiter (120 requests / minute)
export const generalLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP. Please slow down.',
});

// 2. Strict Auth limiter (20 requests / 15 minutes) to protect OAuth and login endpoints
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// 3. User Sync limiter (10 requests / 5 minutes) to prevent GitHub API quota depletion
export const syncLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Synchronization rate limit reached. Please wait a few minutes before triggering another sync.',
});

// 4. Search limiter (30 requests / minute) to prevent database text search abuse
export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Search query rate limit reached. Please wait a moment before searching again.',
});

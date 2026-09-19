import { describe, it, expect, vi } from 'vitest';
import { CacheService, getRedisClient } from '../src/lib/redis.js';

describe('Redis Cache Non-Blocking Resilience & Namespacing', () => {
  it('does not throw when Redis get fails or encounters malformed JSON', async () => {
    const client = getRedisClient();
    const getSpy = vi.spyOn(client, 'get').mockRejectedValueOnce(new Error('Connection timeout to Redis'));

    // Should return null gracefully instead of throwing
    const result = await CacheService.get('sample-key');
    expect(result).toBeNull();
    getSpy.mockRestore();
  });

  it('does not throw when Redis set fails', async () => {
    const client = getRedisClient();
    const setSpy = vi.spyOn(client, 'set').mockRejectedValueOnce(new Error('Redis cluster down'));

    // Should resolve without rejecting
    await expect(CacheService.set('sample-key', { foo: 'bar' })).resolves.toBeUndefined();
    setSpy.mockRestore();
  });

  it('does not throw when Redis invalidatePattern fails', async () => {
    const client = getRedisClient();
    const keysSpy = vi.spyOn(client, 'keys').mockRejectedValueOnce(new Error('Redis connection refused'));

    // Should resolve without rejecting
    await expect(CacheService.invalidatePattern('leaderboard:*')).resolves.toBeUndefined();
    keysSpy.mockRestore();
  });

  it('returns null on malformed cached JSON without throwing JSON syntax errors', async () => {
    const client = getRedisClient();
    const getSpy = vi.spyOn(client, 'get').mockResolvedValueOnce('invalid{json[not-parseable');

    const result = await CacheService.get('corrupted-key');
    expect(result).toBeNull();
    getSpy.mockRestore();
  });
});

import { describe, it, expect } from 'vitest';
import { parseRateLimitHeaders } from '../src/rate-limit.js';

describe('GitHub Rate Limit Parser', () => {
  it('parses standard rate limit headers accurately', () => {
    const headers = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4850',
      'x-ratelimit-reset': '1700000000',
      'x-ratelimit-used': '150',
      'x-ratelimit-resource': 'core',
    };

    const parsed = parseRateLimitHeaders(headers);
    expect(parsed).not.toBeNull();
    expect(parsed?.limit).toBe(5000);
    expect(parsed?.remaining).toBe(4850);
    expect(parsed?.used).toBe(150);
    expect(parsed?.resetAt.getTime()).toBe(1700000000 * 1000);
    expect(parsed?.resource).toBe('core');
  });

  it('returns null when required rate limit headers are missing', () => {
    expect(parseRateLimitHeaders({})).toBeNull();
    expect(parseRateLimitHeaders({ 'content-type': 'application/json' })).toBeNull();
  });
});

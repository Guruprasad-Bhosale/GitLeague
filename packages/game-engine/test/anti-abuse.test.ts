import { describe, it, expect } from 'vitest';
import { clampNonNegative, sanitizeStats } from '../src/anti-abuse.js';

describe('Game Engine — Anti-Abuse & Input Sanitization', () => {
  it('clamps invalid numerical values to zero', () => {
    expect(clampNonNegative(-100)).toBe(0);
    expect(clampNonNegative(NaN)).toBe(0);
    expect(clampNonNegative(Infinity)).toBe(0);
    expect(clampNonNegative(undefined)).toBe(0);
    expect(clampNonNegative('string')).toBe(0);
    expect(clampNonNegative(42.8)).toBe(42);
  });

  it('sanitizes full stats input and enforces logic constraints', () => {
    const raw = {
      commits: -50,
      pullRequests: 5,
      mergedPullRequests: 10, // cannot exceed total PRs
      issues: NaN,
      repositories: 3,
      stars: -2,
      contributionDays: 50000, // clamped
      currentStreak: 10000, // clamped
    };

    const sanitized = sanitizeStats(raw);
    expect(sanitized.commits).toBe(0);
    expect(sanitized.pullRequests).toBe(5);
    expect(sanitized.mergedPullRequests).toBe(5); // clamped to total PRs
    expect(sanitized.issues).toBe(0);
    expect(sanitized.repositories).toBe(3);
    expect(sanitized.stars).toBe(0);
    expect(sanitized.contributionDays).toBe(3650);
    expect(sanitized.currentStreak).toBe(3650);
  });
});

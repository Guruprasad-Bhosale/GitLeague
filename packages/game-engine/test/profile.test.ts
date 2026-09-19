import { describe, it, expect } from 'vitest';
import { calculateGameProfile } from '../src/profile.js';

describe('Game Engine — Master calculateGameProfile()', () => {
  it('deterministically calculates complete game profile from raw metrics', () => {
    const rawStats = {
      commits: 100, // 1000 XP
      pullRequests: 10, // 400 XP
      mergedPullRequests: 5, // 300 XP
      issues: 4, // 80 XP
      repositories: 3, // 300 XP
      stars: 20, // 100 XP
      contributionDays: 25, // 250 XP
      currentStreak: 12, // 180 XP
    };

    const contributionDates = [
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16', // 12-day streak
    ];

    const result = calculateGameProfile(rawStats, {
      contributionDates,
      referenceDate: '2026-09-16',
    });

    expect(result.xp).toBe(2610);
    expect(result.level).toBe(11); // 2610 / 250 + 1 = 11
    expect(result.tier).toBe('GOLD');
    expect(result.levelProgress.xpInCurrentLevel).toBe(110); // 2610 - 2500
    expect(result.tierProgress.currentTier).toBe('GOLD');
    expect(result.tierProgress.nextTier).toBe('PLATINUM');
    expect(result.stats.coding).toBeGreaterThan(0);
    expect(result.stats.coding).toBeLessThanOrEqual(100);
    expect(result.streak.currentStreak).toBe(12);
    expect(result.streak.longestStreak).toBe(12);
    expect(result.achievements).toHaveLength(15);
    expect(result.xpBreakdown.totalXP).toBe(2610);
  });

  it('guarantees identical deterministic output given identical inputs', () => {
    const input = {
      commits: 250,
      pullRequests: 15,
      mergedPullRequests: 8,
      issues: 6,
      repositories: 7,
      stars: 50,
      contributionDays: 80,
      currentStreak: 20,
    };

    const run1 = calculateGameProfile(input, { referenceDate: '2026-09-16' });
    const run2 = calculateGameProfile(input, { referenceDate: '2026-09-16' });

    expect(run1).toEqual(run2);
  });
});

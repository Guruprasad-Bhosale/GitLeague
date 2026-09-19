import { describe, it, expect } from 'vitest';
import { calculateXP, calculateLevel, calculateTier } from '../src/index.js';

describe('Game Engine Calculations', () => {
  it('calculates XP correctly from raw stats', () => {
    const stats = {
      commits: 100, // 100 * 10 = 1000
      pullRequests: 5, // 5 * 40 = 200
      mergedPullRequests: 3, // 3 * 60 = 180
      issues: 2, // 2 * 20 = 40
      repositories: 4, // 4 * 100 = 400
      stars: 10, // 10 * 5 = 50
      contributionDays: 30, // 30 * 10 = 300
      currentStreak: 10, // 10 * 15 = 150
    };

    const xp = calculateXP(stats);
    expect(xp).toBe(1000 + 200 + 180 + 40 + 400 + 50 + 300 + 150); // 2320
  });

  it('calculates levels based on 250 XP curve', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(249)).toBe(1);
    expect(calculateLevel(250)).toBe(2);
    expect(calculateLevel(2500)).toBe(11);
  });

  it('determines appropriate tiers based on thresholds', () => {
    expect(calculateTier(1, 100)).toBe('BRONZE');
    expect(calculateTier(5, 1250)).toBe('SILVER');
    expect(calculateTier(10, 2500)).toBe('GOLD');
    expect(calculateTier(75, 19000)).toBe('GRANDMASTER');
  });
});

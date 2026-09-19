import { describe, it, expect } from 'vitest';
import { calculateTier, getTierFromXP, getTierProgress } from '../src/tier.js';

describe('Game Engine — Tier Detection & Progression', () => {
  it('determines tiers based on configured thresholds', () => {
    expect(calculateTier(1, 0)).toBe('BRONZE');
    expect(calculateTier(4, 1200)).toBe('BRONZE');
    expect(calculateTier(5, 1250)).toBe('SILVER');
    expect(calculateTier(10, 2500)).toBe('GOLD');
    expect(calculateTier(20, 5000)).toBe('PLATINUM');
    expect(calculateTier(35, 8750)).toBe('DIAMOND');
    expect(calculateTier(50, 12500)).toBe('MASTER');
    expect(calculateTier(75, 18750)).toBe('GRANDMASTER');
    expect(calculateTier(100, 30000)).toBe('GRANDMASTER');
  });

  it('safely handles negative inputs without producing invalid tiers', () => {
    expect(calculateTier(-5, -100)).toBe('BRONZE');
    expect(getTierFromXP(-500)).toBe('BRONZE');
    expect(getTierFromXP(NaN)).toBe('BRONZE');
  });

  it('calculates tier progression and XP to next tier accurately', () => {
    const progress = getTierProgress(2000); // Between Silver (1250) and Gold (2500)
    expect(progress.currentTier).toBe('SILVER');
    expect(progress.nextTier).toBe('GOLD');
    expect(progress.currentTierMinXP).toBe(1250);
    expect(progress.nextTierMinXP).toBe(2500);
    expect(progress.xpToNextTier).toBe(500); // 2500 - 2000
    expect(progress.tierProgressPercentage).toBe(60); // (2000 - 1250) / (2500 - 1250) = 750 / 1250 = 60%
  });

  it('handles maximum Grandmaster tier without next tier overflow', () => {
    const progress = getTierProgress(25000);
    expect(progress.currentTier).toBe('GRANDMASTER');
    expect(progress.nextTier).toBeNull();
    expect(progress.xpToNextTier).toBe(0);
    expect(progress.tierProgressPercentage).toBe(100);
  });
});

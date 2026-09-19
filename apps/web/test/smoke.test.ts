import { describe, it, expect } from 'vitest';
import { TIER_THRESHOLDS } from '@gitleague/config';

describe('Web App Environment & Leaderboard Foundation', () => {
  it('loads game rules and league tier definitions correctly', () => {
    expect(TIER_THRESHOLDS.BRONZE).toBeDefined();
    expect(TIER_THRESHOLDS.GRANDMASTER).toBeDefined();
    expect(TIER_THRESHOLDS.GRANDMASTER.minLevel).toBe(75);
  });

  it('verifies supported leaderboard tier keys are calibrated', () => {
    const tiers = Object.keys(TIER_THRESHOLDS);
    expect(tiers).toContain('BRONZE');
    expect(tiers).toContain('SILVER');
    expect(tiers).toContain('GOLD');
    expect(tiers).toContain('PLATINUM');
    expect(tiers).toContain('DIAMOND');
    expect(tiers).toContain('MASTER');
    expect(tiers).toContain('GRANDMASTER');
  });
});

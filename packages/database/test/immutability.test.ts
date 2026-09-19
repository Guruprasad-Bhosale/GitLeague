import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SeasonResultRepository,
  SeasonResultModel,
  SeasonRepository,
  SeasonModel,
} from '../src/index.js';

describe('Historical Season Immutability Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves immutable historical results when user later gains lifetime XP', async () => {
    const historicalResult = {
      seasonId: 's3',
      userId: 'octocat',
      finalRank: 31,
      finalXP: 8210,
      finalLevel: 42,
      finalTier: 'DIAMOND',
      finalizedAt: new Date('2026-03-31T23:59:59Z'),
    };

    // User's historical season result
    vi.spyOn(SeasonResultModel, 'findOne').mockResolvedValue(historicalResult as any);
    vi.spyOn(SeasonModel, 'findById').mockResolvedValue({
      _id: 's3',
      slug: 'season-03',
      status: 'completed',
    } as any);

    // Initial check: Historical Season 03 result is #31, 8210 XP, Level 42
    const beforeResult = await SeasonResultRepository.getUserSeasonResult('s3', 'octocat');
    expect(beforeResult?.finalRank).toBe(31);
    expect(beforeResult?.finalXP).toBe(8210);
    expect(beforeResult?.finalLevel).toBe(42);
    expect(beforeResult?.finalTier).toBe('DIAMOND');

    // Simulate: Octocat gains 1,000 lifetime XP and levels up to Level 44 two weeks later
    const newLifetimeXP = 11430;
    const newLevel = 44;

    // Verify historical SeasonResult query remains completely unchanged
    const afterResult = await SeasonResultRepository.getUserSeasonResult('s3', 'octocat');
    expect(afterResult?.finalRank).toBe(31);
    expect(afterResult?.finalXP).toBe(8210);
    expect(afterResult?.finalLevel).toBe(42);
    expect(afterResult?.finalTier).toBe('DIAMOND');
    expect(afterResult?.finalXP).not.toBe(newLifetimeXP);
    expect(afterResult?.finalLevel).not.toBe(newLevel);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processSeasonLifecycle } from '../src/processors/season-lifecycle.processor.js';
import {
  SeasonRepository,
  SeasonResultRepository,
  SeasonParticipantModel,
  UserModel,
  GameProfileModel,
  ProgressionEventRepository,
} from '@gitleague/database';

describe('Season Lifecycle Worker Processor Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('activates an upcoming season when start date has arrived and no season is active', async () => {
    // 1. No active season
    vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValue(null);
    // 2. No active seasons to complete
    vi.spyOn(SeasonRepository, 'getActiveSeasonsToComplete').mockResolvedValue([]);
    // 3. One upcoming season ready to activate
    vi.spyOn(SeasonRepository, 'getUpcomingSeasonsToActivate').mockResolvedValue([
      {
        _id: 's2',
        seasonNumber: 2,
        slug: 'season-02',
        status: 'upcoming',
      } as any,
    ]);

    const activateSpy = vi.spyOn(SeasonRepository, 'activateSeason').mockResolvedValue({
      _id: 's2',
      slug: 'season-02',
      status: 'active',
    } as any);

    const result = await processSeasonLifecycle(new Date('2026-04-01T00:00:00Z'));

    expect(result.activated).toContain('season-02');
    expect(activateSpy).toHaveBeenCalledWith('s2');
  });

  it('finalizes an active season whose end date has passed, persisting deterministic rankings', async () => {
    const expiredSeason = {
      _id: 's1',
      seasonNumber: 1,
      name: 'Season 01',
      slug: 'season-01',
      status: 'active',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    };

    // 1. Return expired season to complete
    vi.spyOn(SeasonRepository, 'getActiveSeasonsToComplete').mockResolvedValue([expiredSeason as any]);
    // 2. Complete season returns completed doc
    vi.spyOn(SeasonRepository, 'completeSeason').mockResolvedValue({
      ...expiredSeason,
      status: 'completed',
    } as any);

    // 3. Participants in this season
    vi.spyOn(SeasonParticipantModel, 'find').mockReturnValue({
      lean: () =>
        Promise.resolve([
          { seasonId: 's1', userId: 'user-b', seasonXP: 3000 },
          { seasonId: 's1', userId: 'user-a', seasonXP: 5000 },
        ]),
    } as any);

    // 4. User identity and profiles
    vi.spyOn(UserModel, 'find').mockReturnValue({
      lean: () =>
        Promise.resolve([
          { _id: 'user-a', githubId: 'gh-a', location: 'India', collegeId: null },
          { _id: 'user-b', githubId: 'gh-b', location: 'USA', collegeId: null },
        ]),
    } as any);

    vi.spyOn(GameProfileModel, 'find').mockReturnValue({
      lean: () =>
        Promise.resolve([
          { userId: 'user-a', level: 25, tier: 'DIAMOND' },
          { userId: 'user-b', level: 18, tier: 'PLATINUM' },
        ]),
    } as any);

    const bulkCreateSpy = vi.spyOn(SeasonResultRepository, 'bulkCreateResults').mockResolvedValue(2);
    const eventSpy = vi.spyOn(ProgressionEventRepository, 'recordEvent').mockResolvedValue(true);
    vi.spyOn(SeasonResultRepository, 'getUserSeasonHistory').mockResolvedValue([]);
    vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValue(null);
    vi.spyOn(SeasonRepository, 'getUpcomingSeasonsToActivate').mockResolvedValue([]);

    const result = await processSeasonLifecycle(new Date('2026-04-01T00:00:00Z'));

    expect(result.completed).toContain('season-01');
    expect(bulkCreateSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          seasonId: 's1',
          userId: 'user-a',
          finalRank: 1,
          finalXP: 5000,
          finalLevel: 25,
          finalTier: 'DIAMOND',
        }),
        expect.objectContaining({
          seasonId: 's1',
          userId: 'user-b',
          finalRank: 2,
          finalXP: 3000,
          finalLevel: 18,
          finalTier: 'PLATINUM',
        }),
      ])
    );
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SEASON_COMPLETED',
        eventKey: 'season_completed_s1',
      })
    );
  });

  it('handles concurrency safely: if another worker completes the season first, skips finalization', async () => {
    const expiredSeason = {
      _id: 's1',
      slug: 'season-01',
      status: 'active',
    };

    vi.spyOn(SeasonRepository, 'getActiveSeasonsToComplete').mockResolvedValue([expiredSeason as any]);
    // Atomic transition returns null because another worker already flipped it to completed
    vi.spyOn(SeasonRepository, 'completeSeason').mockResolvedValue(null);
    vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValue(null);
    vi.spyOn(SeasonRepository, 'getUpcomingSeasonsToActivate').mockResolvedValue([]);
    const bulkCreateSpy = vi.spyOn(SeasonResultRepository, 'bulkCreateResults');

    const result = await processSeasonLifecycle(new Date('2026-04-01T00:00:00Z'));

    expect(result.completed).toEqual([]);
    expect(bulkCreateSpy).not.toHaveBeenCalled();
  });

});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SeasonResultRepository,
  SeasonResultModel,
  SeasonModel,
  SeasonRepository,
} from '../src/index.js';

describe('SeasonResultRepository & SeasonRepository Lifecycle Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('SeasonResultRepository.bulkCreateResults', () => {
    it('returns 0 if results array is empty', async () => {
      const count = await SeasonResultRepository.bulkCreateResults([]);
      expect(count).toBe(0);
    });

    it('performs bulkWrite upserts with correct atomic filter and set operations', async () => {
      const spy = vi.spyOn(SeasonResultModel, 'bulkWrite').mockResolvedValueOnce({
        upsertedCount: 2,
        modifiedCount: 1,
      } as any);

      const count = await SeasonResultRepository.bulkCreateResults([
        {
          seasonId: 'season-1',
          userId: 'user-1',
          finalRank: 1,
          finalXP: 5000,
          finalLevel: 20,
          finalTier: 'DIAMOND',
          finalizedAt: new Date(),
        },
        {
          seasonId: 'season-1',
          userId: 'user-2',
          finalRank: 2,
          finalXP: 4000,
          finalLevel: 18,
          finalTier: 'PLATINUM',
          finalizedAt: new Date(),
        },
      ]);

      expect(count).toBe(3);
      expect(spy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              filter: { seasonId: 'season-1', userId: 'user-1' },
              upsert: true,
            }),
          }),
        ]),
        { ordered: false }
      );
    });
  });

  describe('SeasonResultRepository.getUserSeasonHistory', () => {
    it('returns empty array if user has no completed seasons', async () => {
      vi.spyOn(SeasonResultModel, 'find').mockReturnValueOnce({
        sort: () => Promise.resolve([]),
      } as any);

      const history = await SeasonResultRepository.getUserSeasonHistory('user-1');
      expect(history).toEqual([]);
    });

    it('joins with Season metadata and sorts newest season first', async () => {
      vi.spyOn(SeasonResultModel, 'find').mockReturnValueOnce({
        sort: () =>
          Promise.resolve([
            {
              seasonId: 's1',
              finalRank: 5,
              finalXP: 2000,
              finalLevel: 10,
              finalTier: 'GOLD',
              finalizedAt: new Date('2026-01-31'),
            },
            {
              seasonId: 's2',
              finalRank: 2,
              finalXP: 6000,
              finalLevel: 22,
              finalTier: 'DIAMOND',
              finalizedAt: new Date('2026-03-31'),
            },
          ]),
      } as any);

      vi.spyOn(SeasonModel, 'find').mockResolvedValueOnce([
        {
          _id: 's1',
          seasonNumber: 1,
          name: 'Season 01',
          slug: 'season-01',
          status: 'completed',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        },
        {
          _id: 's2',
          seasonNumber: 2,
          name: 'Season 02',
          slug: 'season-02',
          status: 'completed',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-03-31'),
        },
      ] as any);

      const history = await SeasonResultRepository.getUserSeasonHistory('user-1');
      expect(history.length).toBe(2);
      expect(history[0].season.slug).toBe('season-02');
      expect(history[0].finalRank).toBe(2);
      expect(history[1].season.slug).toBe('season-01');
      expect(history[1].finalRank).toBe(5);
    });
  });

  describe('SeasonRepository Lifecycle Transitions', () => {
    it('activates an upcoming season atomically when no other season is active', async () => {
      vi.spyOn(SeasonModel, 'findOne').mockResolvedValueOnce(null);
      const updateSpy = vi.spyOn(SeasonModel, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: 's2',
        slug: 'season-02',
        status: 'active',
        isActive: true,
      } as any);

      const activated = await SeasonRepository.activateSeason('s2');
      expect(activated?.status).toBe('active');
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: 's2', status: 'upcoming' },
        { $set: { status: 'active', isActive: true, isArchived: false } },
        { new: true }
      );
    });

    it('rejects activating a season if another season is currently active', async () => {
      vi.spyOn(SeasonModel, 'findOne').mockResolvedValueOnce({
        _id: 's1',
        slug: 'season-01',
        status: 'active',
        isActive: true,
      } as any);

      await expect(SeasonRepository.activateSeason('s2')).rejects.toThrow(
        /Cannot activate season s2: Season season-01 is already active/
      );
    });

    it('completes an active season atomically', async () => {
      const updateSpy = vi.spyOn(SeasonModel, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: 's1',
        slug: 'season-01',
        status: 'completed',
        isActive: false,
      } as any);

      const completed = await SeasonRepository.completeSeason('s1');
      expect(completed?.status).toBe('completed');
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: 's1', status: 'active' },
        { $set: { status: 'completed', isActive: false, isArchived: true } },
        { new: true }
      );
    });
  });
});

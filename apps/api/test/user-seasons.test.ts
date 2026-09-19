import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  UserModel,
  SeasonModel,
  SeasonResultRepository,
  RankSnapshotRepository,
} from '@gitleague/database';
import type { Express } from 'express';

describe('User Seasons & Rank History API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/users/:username/seasons', () => {
    it('returns 404 if user does not exist', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/users/nonexistent-user/seasons');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });


    it('returns 200 with user season history', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
        _id: '507f1f77bcf86cd799439011',
        username: 'octocat',
      } as any);

      vi.spyOn(SeasonResultRepository, 'getUserSeasonHistory').mockResolvedValueOnce([
        {
          season: {
            id: 's2',
            seasonNumber: 2,
            name: 'Season 02',
            slug: 'season-02',
            status: 'completed',
            startDate: new Date('2026-02-01'),
            endDate: new Date('2026-03-31'),
          },
          finalRank: 12,
          finalXP: 8200,
          finalLevel: 28,
          finalTier: 'DIAMOND',
          completedAt: new Date('2026-03-31'),
        },
      ]);

      const res = await request(app).get('/api/v1/users/octocat/seasons');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].season.slug).toBe('season-02');
      expect(res.body.data[0].finalRank).toBe(12);
      expect(res.body.data[0].finalXP).toBe(8200);
    });
  });

  describe('GET /api/v1/users/:username/rank-history', () => {
    it('returns 404 if user does not exist', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/users/ghost-user/rank-history');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });


    it('returns 404 if specified season does not exist', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
        _id: '507f1f77bcf86cd799439011',
        username: 'octocat',
      } as any);

      vi.spyOn(SeasonModel, 'findOne').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/users/octocat/rank-history?season=invalid-season');
      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Season "invalid-season" not found');
    });

    it('returns persisted snapshots without interpolating fake data', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
        _id: '507f1f77bcf86cd799439011',
        username: 'octocat',
      } as any);

      vi.spyOn(RankSnapshotRepository, 'getUserRankHistory').mockResolvedValueOnce([
        {
          periodKey: 'daily_2026-03-10',
          rank: 25,
          xp: 4000,
          capturedAt: new Date('2026-03-10'),
        },
        {
          periodKey: 'daily_2026-03-12',
          rank: 18,
          xp: 4800,
          capturedAt: new Date('2026-03-12'),
        },
      ]);

      const res = await request(app).get('/api/v1/users/octocat/rank-history?scope=global');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe('507f1f77bcf86cd799439011');
      expect(res.body.data.username).toBe('octocat');
      expect(res.body.data.leaderboardType).toBe('lifetime');
      expect(res.body.data.scope).toBe('global');
      expect(res.body.data.snapshots.length).toBe(2);
      expect(res.body.data.snapshots[0].rank).toBe(25);
      expect(res.body.data.snapshots[1].rank).toBe(18);
    });
  });
});

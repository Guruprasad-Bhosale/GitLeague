import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SeasonRepository } from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('Seasons API Endpoints (/api/v1/seasons)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
  });

  const mockSeason = {
    _id: '507f1f77bcf86cd799439011',
    seasonNumber: 1,
    name: 'Season 01 — Genesis',
    slug: 'season-01',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2026-11-30T23:59:59Z'),
    status: 'active' as const,
    isActive: true,
    isArchived: false,
    participantsCount: 150,
  };

  describe('GET /api/v1/seasons', () => {
    it('returns list of all seasons', async () => {
      vi.spyOn(SeasonRepository, 'listSeasons').mockResolvedValueOnce([mockSeason as any]);

      const res = await request(app).get('/api/v1/seasons');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe('season-01');
      expect(res.body.data[0].status).toBe('active');
    });
  });

  describe('GET /api/v1/seasons/current', () => {
    it('returns current active season when one is running', async () => {
      vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValueOnce(mockSeason as any);

      const res = await request(app).get('/api/v1/seasons/current');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('season-01');
      expect(res.body.data.status).toBe('active');
    });

    it('returns null with 200 OK when in off-season (no active season)', async () => {
      vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/seasons/current');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
      expect(res.body.message).toContain('No active competitive season');
    });
  });

  describe('GET /api/v1/seasons/:slug', () => {
    it('returns season details for valid slug', async () => {
      vi.spyOn(SeasonRepository, 'findBySlug').mockResolvedValueOnce(mockSeason as any);

      const res = await request(app).get('/api/v1/seasons/season-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('season-01');
    });

    it('returns 404 for nonexistent season', async () => {
      vi.spyOn(SeasonRepository, 'findBySlug').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/seasons/season-99');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('POST /api/v1/seasons', () => {
    it('creates a new season explicitly with valid parameters', async () => {
      vi.spyOn(SeasonRepository, 'createSeason').mockResolvedValueOnce(mockSeason as any);

      const res = await request(app)
        .post('/api/v1/seasons')
        .send({
          seasonNumber: 1,
          name: 'Season 01 — Genesis',
          slug: 'season-01',
          startDate: '2026-09-01T00:00:00Z',
          endDate: '2026-11-30T23:59:59Z',
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('season-01');
    });

    it('rejects creation if startDate is after endDate (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/seasons')
        .send({
          seasonNumber: 1,
          name: 'Invalid Season',
          slug: 'invalid-season',
          startDate: '2026-12-01T00:00:00Z',
          endDate: '2026-10-01T00:00:00Z',
          status: 'active',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /api/v1/leaderboard?season=season-01', () => {
    it('delegates to SeasonRepository for season-filtered leaderboard query', async () => {
      vi.spyOn(SeasonRepository, 'findBySlug').mockResolvedValueOnce(mockSeason as any);
      const getSeasonLeaderboardSpy = vi.spyOn(SeasonRepository, 'getSeasonLeaderboard').mockResolvedValueOnce({
        data: [
          {
            rank: 1,
            rankMovement: 0,
            userId: 'user_1',
            username: 'season_leader',
            displayName: 'Season Leader',
            avatarUrl: 'https://avatar.url',
            level: 30,
            tier: 'GOLD',
            xp: 7500,
            seasonXP: 2500,
            commits: 120,
            pullRequests: 15,
            currentStreak: 7,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app).get('/api/v1/leaderboard?season=season-01&page=1&limit=25');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].seasonXP).toBe(2500);
      expect(getSeasonLeaderboardSpy).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ page: 1, limit: 25 })
      );
    });
  });
});

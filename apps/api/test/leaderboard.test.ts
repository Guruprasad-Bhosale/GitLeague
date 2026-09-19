import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GameProfileRepository, SessionRepository, UserRepository } from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('Leaderboard API Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
  });

  describe('GET /api/v1/leaderboard', () => {
    it('returns empty leaderboard list and correct pagination metadata when no participants exist', async () => {
      vi.spyOn(GameProfileRepository, 'getLeaderboard').mockResolvedValueOnce({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app).get('/api/v1/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.page).toBe(1);
    });

    it('returns ranked participants with deterministic ordering and metrics', async () => {
      const mockEntries = [
        {
          rank: 1,
          rankMovement: 0,
          userId: 'user-1',
          username: 'topcoder',
          displayName: 'Top Coder',
          avatarUrl: 'https://avatars.github.com/u/1',
          level: 45,
          tier: 'DIAMOND' as const,
          xp: 11250,
          seasonXP: 11250,
          commits: 420,
          pullRequests: 50,
          currentStreak: 15,
        },
        {
          rank: 2,
          rankMovement: 1,
          userId: 'user-2',
          username: 'secondcoder',
          displayName: 'Second Coder',
          avatarUrl: 'https://avatars.github.com/u/2',
          level: 40,
          tier: 'DIAMOND' as const,
          xp: 10000,
          seasonXP: 10000,
          commits: 300,
          pullRequests: 30,
          currentStreak: 8,
        },
      ];

      vi.spyOn(GameProfileRepository, 'getLeaderboard').mockResolvedValueOnce({
        data: mockEntries,
        meta: {
          total: 2,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app).get('/api/v1/leaderboard?page=1&limit=25');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].username).toBe('topcoder');
      expect(res.body.data[0].rank).toBe(1);
      expect(res.body.data[0].xp).toBe(11250);
    });

    it('filters by country scope properly', async () => {
      const spy = vi.spyOn(GameProfileRepository, 'getLeaderboard').mockResolvedValueOnce({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app).get('/api/v1/leaderboard?scope=country&country=India');

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'country',
          country: 'India',
        })
      );
    });

    it('returns empty result with future expansion notice for unpopulated scopes', async () => {
      const res = await request(app).get('/api/v1/leaderboard?scope=region');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.scopeNote).toContain('Region leaderboard scope is scheduled');
    });

    it('validates invalid query parameters (e.g. negative page)', async () => {
      const res = await request(app).get('/api/v1/leaderboard?page=-5');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /api/v1/leaderboard/me', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app).get('/api/v1/leaderboard/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns authenticated user personal ranking and percentile', async () => {
      const mockSession = {
        _id: 'session_123',
        userId: '507f1f77bcf86cd799439011',
        sessionHash: 'hash_123',
        expiresAt: new Date(Date.now() + 86400000),
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        githubId: '12345',
        username: 'testdev',
        avatarUrl: 'https://avatar.url',
        githubProfileUrl: 'https://github.com/testdev',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(SessionRepository, 'touchSession').mockResolvedValueOnce();
      vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
      vi.spyOn(UserRepository, 'toSafeUser').mockReturnValueOnce({
        id: '507f1f77bcf86cd799439011',
        githubId: '12345',
        username: 'testdev',
        avatarUrl: 'https://avatar.url',
        githubProfileUrl: 'https://github.com/testdev',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      vi.spyOn(GameProfileRepository, 'getUserRank').mockResolvedValueOnce({
        currentRank: 12,
        previousRank: 14,
        rankMovement: 2,
        totalParticipants: 200,
        percentile: 94.0,
        xp: 7500,
        seasonXP: 7500,
        level: 30,
        tier: 'GOLD',
      });

      const res = await request(app)
        .get('/api/v1/leaderboard/me')
        .set('Cookie', ['gitleague_session=valid_raw_session_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentRank).toBe(12);
      expect(res.body.data.percentile).toBe(94.0);
      expect(res.body.data.rankMovement).toBe(2);
    });
  });
});

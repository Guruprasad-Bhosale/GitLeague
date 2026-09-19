import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  GameProfileRepository,
  FriendshipRepository,
  SessionRepository,
  UserRepository,
  UserModel,
  SeasonRepository,
} from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('Social Leaderboard Scopes (Friends & College)', () => {
  const app = createApp();

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    githubId: '1001',
    username: 'maindev',
    collegeId: '607f1f77bcf86cd799439099',
  };

  const mockSession = {
    _id: 'session_123',
    userId: mockUser.id,
    sessionHash: 'hash_123',
    expiresAt: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
    vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValue(mockSession as any);
    vi.spyOn(SessionRepository, 'touchSession').mockResolvedValue();
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUser as any);
    vi.spyOn(UserRepository, 'toSafeUser').mockReturnValue({
      id: mockUser.id,
      githubId: mockUser.githubId,
      username: mockUser.username,
      displayName: 'Main Dev',
      avatarUrl: 'https://avatar.url',
      githubProfileUrl: 'https://github.com/maindev',
      collegeId: mockUser.collegeId,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
  });

  describe('Friends Leaderboard (scope=friends)', () => {
    it('requires authentication (401) when not signed in', async () => {
      const res = await request(app).get('/api/v1/leaderboard?scope=friends');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('filters leaderboard to authenticated user + accepted friends', async () => {
      vi.spyOn(FriendshipRepository, 'getFriendUserIds').mockResolvedValueOnce(['friend-1', 'friend-2']);
      const getLeaderboardSpy = vi.spyOn(GameProfileRepository, 'getLeaderboard').mockResolvedValueOnce({
        data: [
          {
            rank: 1,
            rankMovement: 0,
            userId: mockUser.id,
            username: 'maindev',
            displayName: 'Main Dev',
            avatarUrl: 'https://avatar.url',
            level: 30,
            tier: 'GOLD' as const,
            xp: 7000,
            seasonXP: 7000,
            commits: 100,
            pullRequests: 20,
            currentStreak: 5,
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

      const res = await request(app)
        .get('/api/v1/leaderboard?scope=friends')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getLeaderboardSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'friends',
          userIds: [mockUser.id, 'friend-1', 'friend-2'],
        })
      );
    });

    it('returns personal rank within friends scope', async () => {
      vi.spyOn(FriendshipRepository, 'getFriendUserIds').mockResolvedValueOnce(['friend-1', 'friend-2']);
      vi.spyOn(GameProfileRepository, 'getUserRank').mockResolvedValueOnce({
        currentRank: 2,
        previousRank: 2,
        rankMovement: 0,
        totalParticipants: 3,
        percentile: 66.7,
        xp: 7000,
        seasonXP: 7000,
        level: 30,
        tier: 'GOLD',
      });

      const res = await request(app)
        .get('/api/v1/leaderboard/me?scope=friends')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentRank).toBe(2);
      expect(res.body.data.totalParticipants).toBe(3);
    });
  });

  describe('College Leaderboard (scope=college)', () => {
    it('filters leaderboard to members of the user college', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(mockUser as any);
      const getLeaderboardSpy = vi.spyOn(GameProfileRepository, 'getLeaderboard').mockResolvedValueOnce({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/api/v1/leaderboard?scope=college')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getLeaderboardSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'college',
          collegeId: mockUser.collegeId,
        })
      );
    });

    it('returns COLLEGE_NOT_SET scopeNote when user has not configured college affiliation', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
        ...mockUser,
        collegeId: null,
      } as any);

      const res = await request(app)
        .get('/api/v1/leaderboard?scope=college')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.scopeNote).toBe('COLLEGE_NOT_SET');
    });
  });

  describe('Season + Social Scopes Combination', () => {
    it('supports Season 01 + Friends query', async () => {
      const mockSeason = {
        _id: 'season_1',
        slug: 'season-01',
      };
      vi.spyOn(SeasonRepository, 'findBySlug').mockResolvedValueOnce(mockSeason as any);
      vi.spyOn(FriendshipRepository, 'getFriendUserIds').mockResolvedValueOnce(['friend-1']);
      const getSeasonSpy = vi.spyOn(SeasonRepository, 'getSeasonLeaderboard').mockResolvedValueOnce({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/api/v1/leaderboard?season=season-01&scope=friends')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(getSeasonSpy).toHaveBeenCalledWith(
        'season_1',
        expect.objectContaining({
          scope: 'friends',
          userIds: [mockUser.id, 'friend-1'],
        })
      );
    });
  });
});

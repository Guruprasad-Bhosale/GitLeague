import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  UserProfileRepository,
  SessionRepository,
  UserRepository,
} from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('Developer Side-by-Side Comparison API (GET /api/v1/users/:username/compare)', () => {
  const app = createApp();

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    githubId: '1001',
    username: 'devone',
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
      displayName: 'Dev One',
      avatarUrl: 'https://avatar.url/1',
      githubProfileUrl: 'https://github.com/devone',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/users/devtwo/compare');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns factual comparison between authenticated user and target developer', async () => {
    const profileA = {
      userId: mockUser.id,
      username: 'devone',
      displayName: 'Dev One',
      avatarUrl: 'https://avatar.url/1',
      level: 30,
      tier: 'GOLD' as const,
      xp: 7500,
      globalRank: 15,
      countryRank: 5,
      college: null,
      stats: { coding: 70, consistency: 80, builder: 60, openSource: 50 },
      currentStreak: 12,
      longestStreak: 20,
      commits: 350,
      pullRequests: 40,
      issues: 10,
      repositories: 15,
      stars: 45,
      achievements: [{ isUnlocked: true }, { isUnlocked: false }],
    };

    const profileB = {
      userId: '507f1f77bcf86cd799439022',
      username: 'devtwo',
      displayName: 'Dev Two',
      avatarUrl: 'https://avatar.url/2',
      level: 35,
      tier: 'DIAMOND' as const,
      xp: 9000,
      globalRank: 8,
      countryRank: 2,
      college: {
        id: 'c1',
        name: 'IIT Bombay',
        slug: 'iit-bombay',
        verified: true,
      },
      stats: { coding: 85, consistency: 75, builder: 80, openSource: 70 },
      currentStreak: 24,
      longestStreak: 30,
      commits: 500,
      pullRequests: 70,
      issues: 25,
      repositories: 25,
      stars: 120,
      achievements: [{ isUnlocked: true }, { isUnlocked: true }],
    };

    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockImplementation(async (uname) => {
      if (uname === 'devone') return profileA as any;
      if (uname === 'devtwo') return profileB as any;
      return null;
    });

    const res = await request(app)
      .get('/api/v1/users/devtwo/compare')
      .set('Cookie', ['gitleague_session=valid_token']);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userA.username).toBe('devone');
    expect(res.body.data.userB.username).toBe('devtwo');
    expect(res.body.data.userA.level).toBe(30);
    expect(res.body.data.userB.level).toBe(35);
    expect(res.body.data.userB.college.name).toBe('IIT Bombay');
    expect(res.body.data.userA.stats.coding).toBe(70);
    expect(res.body.data.userB.stats.coding).toBe(85);
  });

  it('returns 404 if target developer does not exist or has no game profile', async () => {
    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockImplementation(async (uname) => {
      if (uname === 'devone') return { userId: mockUser.id, username: 'devone' } as any;
      return null;
    });

    const res = await request(app)
      .get('/api/v1/users/nonexistent-dev/compare')
      .set('Cookie', ['gitleague_session=valid_token']);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserProfileRepository } from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';
import type { IUserProfile } from '@gitleague/types';

describe('Public Developer Profile API (GET /api/v1/users/:username/profile)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
  });

  const mockProfile: IUserProfile = {
    userId: '507f1f77bcf86cd799439011',
    username: 'devmaster',
    displayName: 'Dev Master',
    avatarUrl: 'https://avatars.github.com/u/12345',
    githubProfileUrl: 'https://github.com/devmaster',
    bio: 'Fullstack competitive coder',
    location: 'Bangalore, India',
    company: 'Acme Corp',
    level: 42,
    xp: 10500,
    tier: 'DIAMOND',
    tierTitle: 'Algorithm Lord',
    tierProgress: {
      currentTier: 'DIAMOND',
      nextTier: 'MASTER',
      currentTierMinXP: 8750,
      nextTierMinXP: 12500,
      xpToNextTier: 2000,
      tierProgressPercentage: 46,
      title: 'Algorithm Lord',
      color: '#B9F2FF',
    },
    levelProgress: {
      currentLevel: 42,
      currentLevelBaseXP: 10250,
      nextLevelXP: 10500,
      xpInCurrentLevel: 250,
      xpRequiredForNextLevel: 250,
      progressPercentage: 100,
    },
    globalRank: 14,
    countryRank: 3,
    percentile: 95.5,
    currentStreak: 21,
    longestStreak: 45,
    commits: 380,
    pullRequests: 42,
    mergedPullRequests: 38,
    issues: 15,
    repositories: 12,
    stars: 150,
    followers: 85,
    languages: { TypeScript: 120000, Go: 45000 },
    stats: {
      coding: 85,
      consistency: 90,
      builder: 70,
      openSource: 80,
    },
    achievements: [
      {
        id: 'streak_master_30',
        unlockedAt: new Date('2026-08-01T00:00:00Z'),
        progress: 30,
        isUnlocked: true,
      },
    ],
    lastSyncedAt: new Date('2026-09-17T10:00:00Z'),
  };

  it('returns 200 OK and complete public profile DTO for registered GitLeague participant', async () => {
    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockResolvedValueOnce(mockProfile);

    const res = await request(app).get('/api/v1/users/devmaster/profile');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('devmaster');
    expect(res.body.data.level).toBe(42);
    expect(res.body.data.tier).toBe('DIAMOND');
    expect(res.body.data.globalRank).toBe(14);
    expect(res.body.data.countryRank).toBe(3);
    expect(res.body.data.stats.coding).toBe(85);
    expect(res.body.data.achievements.length).toBe(1);

    // Verify Redis cache was populated
    expect(CacheService.set).toHaveBeenCalledWith(
      'profile:devmaster',
      mockProfile,
      60
    );
  });

  it('returns profile from Redis cache if available', async () => {
    vi.spyOn(CacheService, 'get').mockResolvedValueOnce(mockProfile);
    const dbSpy = vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername');

    const res = await request(app).get('/api/v1/users/devmaster/profile');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('devmaster');
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it('returns 404 NOT_FOUND if developer has not joined GitLeague', async () => {
    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockResolvedValueOnce(null);

    const res = await request(app).get('/api/v1/users/nonexistent-dev/profile');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.message).toContain('not joined GitLeague');
  });

  it('rejects invalid username formats (400 Bad Request)', async () => {
    const res = await request(app).get('/api/v1/users/--invalid--name/profile');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('STRICT SECURITY CHECK: sensitive tokens and session credentials are never leaked in profile', async () => {
    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockResolvedValueOnce(mockProfile);

    const res = await request(app).get('/api/v1/users/devmaster/profile');

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.encryptedAccessToken).toBeUndefined();
    expect(data.token).toBeUndefined();
    expect(data.sessionHash).toBeUndefined();
    expect(data.email).toBeUndefined();
  });
});

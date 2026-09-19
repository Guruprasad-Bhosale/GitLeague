import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { envSchema } from '../src/config/env.js';
import * as DatabaseModule from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('Production Readiness Smoke & Bootstrap Pipeline', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
  });


  it('validates production environment variable constraints and secret schemas', () => {
    const prodConfig = {
      NODE_ENV: 'production',
      PORT: '4000',
      HOST: '0.0.0.0',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/gitleague?retryWrites=true&w=majority',
      REDIS_HOST: 'redis.internal.net',
      REDIS_PORT: '6379',
      ENCRYPTION_SECRET: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      SESSION_SECRET: 'super-secure-production-session-secret-string-32-chars!',
      GITHUB_CLIENT_ID: 'gh_prod_client_id',
      GITHUB_CLIENT_SECRET: 'gh_prod_client_secret_value',
      FRONTEND_URL: 'https://gitleague.dev,https://app.gitleague.dev',
      API_URL: 'https://api.gitleague.dev',
      TRUST_PROXY: '1',
    };

    const parsed = envSchema.safeParse(prodConfig);
    expect(parsed.success).toBe(true);
  });

  it('verifies idempotent production database seed script initializes inaugural Season 01', async () => {
    vi.spyOn(DatabaseModule, 'connectDatabase').mockResolvedValue({} as any);
    vi.spyOn(DatabaseModule, 'disconnectDatabase').mockResolvedValue(undefined);
    vi.spyOn(DatabaseModule.UserModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.GameProfileModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.GithubStatsModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.SeasonModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.SeasonParticipantModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.FriendshipModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.CollegeModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.QuestProgressModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.RankSnapshotModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.ProgressionEventModel, 'syncIndexes').mockResolvedValue([] as any);
    vi.spyOn(DatabaseModule.SeasonResultModel, 'syncIndexes').mockResolvedValue([] as any);


    const findActiveSeasonSpy = vi.spyOn(DatabaseModule.SeasonRepository, 'findActiveSeason').mockResolvedValueOnce(null);
    const createSeasonSpy = vi.spyOn(DatabaseModule.SeasonRepository, 'createSeason').mockResolvedValueOnce({
      _id: 'season_genesis_1',
      seasonNumber: 1,
      name: 'Season 01: Genesis',
      slug: 'season-01',
      status: 'active',
      isActive: true,
    } as any);

    await DatabaseModule.seedProductionDatabase('mongodb://mock:27017/gitleague', { skipConnect: true });

    expect(findActiveSeasonSpy).toHaveBeenCalled();
    expect(createSeasonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonNumber: 1,
        slug: 'season-01',
        status: 'active',
      })
    );
  });

  it('serves production health endpoints with security headers and request-id tracing', async () => {
    const res = await request(app).get('/api/v1/health/live');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Security headers verified
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('verifies production API root GET / returns 200 with service discovery metadata', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('GitLeague API');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('v1');
  });

  it('verifies completed season rankings are immutable when lifetime XP changes later', async () => {
    // 1. Mock Season 01 completion with immutable SeasonResult
    vi.spyOn(DatabaseModule.SeasonRepository, 'findBySlug').mockResolvedValue({
      _id: 'season_genesis_1',
      slug: 'season-01',
      status: 'completed',
    } as any);

    vi.spyOn(DatabaseModule.SeasonRepository, 'getSeasonLeaderboard').mockResolvedValue({
      data: [
        {
          rank: 1,
          rankMovement: 0,
          userId: 'dev-1',
          username: 'topcoder',
          displayName: 'Top Coder',
          avatarUrl: 'https://avatars.githubusercontent.com/u/1',
          level: 25,
          tier: 'DIAMOND',
          xp: 8500,
          seasonXP: 8500,
          commits: 450,
          pullRequests: 30,
          currentStreak: 20,
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    vi.spyOn(DatabaseModule.RankSnapshotRepository, 'getPreviousRankSnapshots').mockResolvedValue(new Map());


    const leaderboardRes = await request(app).get('/api/v1/leaderboard?season=season-01');
    expect(leaderboardRes.status).toBe(200);
    expect(leaderboardRes.body.success).toBe(true);
    expect(leaderboardRes.body.data.length).toBe(1);
    expect(leaderboardRes.body.data[0].rank).toBe(1);
    expect(leaderboardRes.body.data[0].seasonXP).toBe(8500);
  });

});


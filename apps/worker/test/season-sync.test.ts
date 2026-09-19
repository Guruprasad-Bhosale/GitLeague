import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUserSync } from '../src/processors/sync.processor.js';
import {
  UserRepository,
  GameProfileRepository,
  GithubStatsRepository,
  SeasonRepository,
  encryptToken,
} from '@gitleague/database';
import { GitHubService } from '@gitleague/github';
import type { Job } from 'bullmq';

describe('Worker — Season XP Accounting & Participation Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validPlainToken = 'gho_seasonTestToken12345';
  const encryptedToken = encryptToken(validPlainToken);

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: '987654',
    username: 'seasondev',
    encryptedAccessToken: encryptedToken,
    syncStatus: 'never_synced',
  };

  const mockActiveSeason = {
    _id: 'season_genesis_123',
    seasonNumber: 1,
    slug: 'season-01',
    name: 'Season 01',
    status: 'active',
    isActive: true,
  };

  const mockJob = {
    id: 'job_season_1',
    data: { userId: '507f1f77bcf86cd799439011' },
  } as unknown as Job<{ userId: string }>;

  it('correctly baselines season XP on initial sync and computes delta XP without wiping lifetime XP', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);
    vi.spyOn(GithubStatsRepository, 'upsertStats').mockResolvedValue({} as any);
    const upsertProfileSpy = vi.spyOn(GameProfileRepository, 'upsertProfile').mockResolvedValue({} as any);

    vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValue(mockActiveSeason as any);
    const recordParticipationSpy = vi.spyOn(SeasonRepository, 'recordSyncParticipation').mockResolvedValue({
      seasonId: 'season_genesis_123',
      userId: '507f1f77bcf86cd799439011',
      lifetimeXPAtSeasonStart: 10000,
      lifetimeXPAtLastSync: 12400,
      seasonXP: 2400,
    } as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockResolvedValueOnce({
      user: {
        id: 987654,
        login: 'seasondev',
        name: 'Season Dev',
        avatarUrl: 'https://avatar.url',
        htmlUrl: 'https://github.com/seasondev',
        bio: null,
        location: 'Earth',
        company: null,
        blog: null,
        twitterUsername: null,
        publicRepositories: 5,
        publicGists: 0,
        followers: 10,
        following: 2,
        createdAt: '2022-01-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      repositories: [],
      stats: {
        totalStars: 10,
        totalForks: 2,
        totalOpenIssues: 0,
        publicRepos: 5,
        languages: {},
      },
      recentActivity: [
        {
          id: 'act_1',
          type: 'PushEvent',
          actor: 'seasondev',
          repo: 'seasondev/repo-1',
          createdAt: '2026-09-17T12:00:00Z',
          payload: { commitsCount: 5 },
        },
      ],
    });

    const result = await processUserSync(mockJob);

    expect(result.success).toBe(true);

    // Verify SeasonRepository.recordSyncParticipation was called with the active season and lifetime XP
    expect(recordParticipationSpy).toHaveBeenCalledWith(
      'season_genesis_123',
      '507f1f77bcf86cd799439011',
      expect.any(Number)
    );

    // Verify GameProfile received the calculated seasonXP delta
    expect(upsertProfileSpy).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        seasonXP: 2400,
      })
    );
  });
});

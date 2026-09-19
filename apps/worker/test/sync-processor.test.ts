import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUserSync } from '../src/processors/sync.processor.js';
import {
  UserRepository,
  GameProfileRepository,
  GithubStatsRepository,
  SeasonRepository,
  encryptToken,
} from '@gitleague/database';
import { GitHubService, GitHubRateLimitError } from '@gitleague/github';
import type { Job } from 'bullmq';

describe('Worker — GitHub User Sync Processor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValue(null);
  });

  const validPlainToken = 'gho_mockToken1234567890';
  const encryptedToken = encryptToken(validPlainToken);

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: '12345',
    username: 'octocat',
    encryptedAccessToken: encryptedToken,
    syncStatus: 'never_synced',
  };

  const mockJob = {
    id: 'job_1',
    data: { userId: '507f1f77bcf86cd799439011' },
  } as unknown as Job<{ userId: string }>;

  it('processes user sync successfully and persists game profile and stats idempotently', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    const updateSyncStatusSpy = vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);
    const upsertStatsSpy = vi.spyOn(GithubStatsRepository, 'upsertStats').mockResolvedValue({} as any);
    const upsertProfileSpy = vi.spyOn(GameProfileRepository, 'upsertProfile').mockResolvedValue({} as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockResolvedValueOnce({
      user: {
        id: 12345,
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatar.url',
        htmlUrl: 'https://github.com/octocat',
        bio: null,
        location: 'San Francisco',
        company: 'GitHub',
        blog: null,
        twitterUsername: null,
        publicRepositories: 8,
        publicGists: 0,
        followers: 120,
        following: 5,
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      repositories: [
        {
          id: 1,
          name: 'repo-1',
          fullName: 'octocat/repo-1',
          isPrivate: false,
          isFork: false,
          isArchived: false,
          htmlUrl: 'https://github.com/octocat/repo-1',
          description: 'A test repo',
          language: 'TypeScript',
          stars: 45,
          forks: 10,
          openIssues: 2,
          watchers: 45,
          defaultBranch: 'main',
          createdAt: '2021-01-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
          pushedAt: '2026-09-01T00:00:00Z',
          sizeKb: 1200,
        },
      ],
      stats: {
        totalStars: 45,
        totalForks: 10,
        totalOpenIssues: 2,
        publicRepos: 8,
        languages: { TypeScript: 1 },
      },
      recentActivity: [
        {
          id: 'act_1',
          type: 'PushEvent',
          actor: 'octocat',
          repo: 'octocat/repo-1',
          createdAt: '2026-09-15T12:00:00Z',
          payload: { commitsCount: 3 },
        },
        {
          id: 'act_2',
          type: 'PullRequestEvent',
          actor: 'octocat',
          repo: 'octocat/repo-1',
          createdAt: '2026-09-16T12:00:00Z',
          payload: { action: 'closed', isMerged: true },
        },
      ],
    });

    const result = await processUserSync(mockJob);

    expect(result.success).toBe(true);
    expect(result.xp).toBeGreaterThan(0);

    // Verify status transitions: syncing -> completed
    expect(updateSyncStatusSpy).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'syncing', expect.any(Object));
    expect(updateSyncStatusSpy).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'completed', expect.any(Object));

    // Verify stats and profile persisted
    expect(upsertStatsSpy).toHaveBeenCalledTimes(1);
    expect(upsertProfileSpy).toHaveBeenCalledTimes(1);
  });

  it('skips gracefully if user is not found in database', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(null);

    const result = await processUserSync(mockJob);
    expect(result.success).toBe(false);
  });

  it('handles and marks user sync as failed when rate limit is exceeded', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    const updateSyncStatusSpy = vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockRejectedValueOnce(
      new GitHubRateLimitError('Rate limit exceeded', 60, new Date())
    );

    await expect(processUserSync(mockJob)).rejects.toThrow(GitHubRateLimitError);

    expect(updateSyncStatusSpy).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'failed',
      expect.objectContaining({ error: expect.stringContaining('Rate Limit') })
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUserSync } from '../src/processors/sync.processor.js';
import {
  UserRepository,
  GameProfileRepository,
  GithubStatsRepository,
  SeasonRepository,
  QuestProgressRepository,
  ProgressionEventRepository,
  encryptToken,
} from '@gitleague/database';
import { GitHubService } from '@gitleague/github';
import type { Job } from 'bullmq';

describe('Worker — Phase 9 Quest & Milestone Progression Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SeasonRepository, 'findActiveSeason').mockResolvedValue(null);
  });

  const validPlainToken = 'gho_mockToken1234567890';
  const encryptedToken = encryptToken(validPlainToken);

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: '12345',
    username: 'questdev',
    encryptedAccessToken: encryptedToken,
    syncStatus: 'never_synced',
  };

  const mockJob = {
    id: 'job_quest_1',
    data: { userId: '507f1f77bcf86cd799439011' },
  } as unknown as Job<{ userId: string }>;

  it('evaluates active quests, grants XP rewards idempotently, and records progression milestones', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);
    vi.spyOn(GithubStatsRepository, 'upsertStats').mockResolvedValue({} as any);

    const prevProfile = {
      userId: '507f1f77bcf86cd799439011',
      level: 1,
      tier: 'BRONZE',
      xp: 100,
      achievements: ['commit_machine_10'],
    };
    vi.spyOn(GameProfileRepository, 'findByUserId').mockResolvedValueOnce(prevProfile as any);

    const upsertProgressSpy = vi.spyOn(QuestProgressRepository, 'upsertProgress').mockResolvedValue({} as any);
    const grantRewardSpy = vi.spyOn(QuestProgressRepository, 'grantReward').mockResolvedValue(true);
    vi.spyOn(QuestProgressRepository, 'getUserQuestProgress').mockResolvedValue([]);
    vi.spyOn(QuestProgressRepository, 'getTotalUserQuestXP').mockResolvedValue(100);

    const recordEventSpy = vi.spyOn(ProgressionEventRepository, 'recordEvent').mockResolvedValue(true);
    const upsertProfileSpy = vi.spyOn(GameProfileRepository, 'upsertProfile').mockResolvedValue({} as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockResolvedValueOnce({
      user: {
        id: 12345,
        login: 'questdev',
        name: 'Quest Dev',
        avatarUrl: 'https://avatar.url',
        htmlUrl: 'https://github.com/questdev',
        bio: null,
        location: null,
        company: null,
        blog: null,
        twitterUsername: null,
        publicRepositories: 10,
        publicGists: 0,
        followers: 10,
        following: 2,
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      repositories: [],
      stats: {
        totalStars: 10,
        totalForks: 2,
        totalOpenIssues: 1,
        publicRepos: 10,
        languages: { TypeScript: 5 },
      },
      recentActivity: [
        {
          id: 'act_q1',
          type: 'PushEvent',
          actor: 'questdev',
          repo: 'questdev/repo-1',
          createdAt: new Date().toISOString(),
          payload: { commitsCount: 5 },
        },
      ],
    });

    const result = await processUserSync(mockJob);

    expect(result.success).toBe(true);
    expect(upsertProgressSpy).toHaveBeenCalled();
    expect(grantRewardSpy).toHaveBeenCalled();
    expect(recordEventSpy).toHaveBeenCalled();
    expect(upsertProfileSpy).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        questXP: 100,
        githubXP: expect.any(Number),
        xp: expect.any(Number),
      })
    );
  });
});

import { Job } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { UserSyncJobPayload } from '../queues/sync.queue.js';
import {
  UserRepository,
  GameProfileRepository,
  GithubStatsRepository,
  SeasonRepository,
  QuestProgressRepository,
  ProgressionEventRepository,
  decryptToken,
} from '@gitleague/database';
import {
  GitHubService,
  GitHubError,
  GitHubRateLimitError,
  GitHubAuthenticationError,
  GitHubForbiddenError,
  GitHubNotFoundError,
} from '@gitleague/github';
import {
  calculateGameProfile,
  RawStatsInput,
  getDailyQuestPeriod,
  getWeeklyQuestPeriod,
  getQuestsForPeriod,
  calculateQuestProgress,
  calculateTotalLifetimeXp,
  calculateLevel,
  calculateTier,
} from '@gitleague/game-engine';
import { redisConfig } from '../config/redis.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

let cacheRedisClient: Redis | null = null;

function getCacheRedisClient(): Redis {
  if (!cacheRedisClient) {
    cacheRedisClient = new Redis(redisConfig);
  }
  return cacheRedisClient;
}

/**
 * Invalidate cached leaderboard and user profile pages in Redis when stats/profile update
 */
export async function invalidateLeaderboardCache(username?: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    const redis = getCacheRedisClient();
    const keys = await redis.keys('leaderboard:*');
    if (username) {
      const profileKeys = await redis.keys(`profile:${username.toLowerCase().trim()}*`);
      keys.push(...profileKeys);
    }
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ invalidatedKeysCount: keys.length }, 'Leaderboard & profile cache invalidated');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to invalidate cache in Redis');
  }
}

/**
 * Process a GitHub User Synchronization Job with idempotency and multi-user isolation
 */
export async function processUserSync(job: Job<UserSyncJobPayload>): Promise<{ success: boolean; xp: number }> {
  const { userId } = job.data;
  const startTime = Date.now();

  logger.info({ jobId: job.id, userId }, 'Starting GitHub background synchronization for user');

  const user = await UserRepository.findById(userId);
  if (!user) {
    logger.warn({ userId }, 'User not found in database for sync job, skipping');
    return { success: false, xp: 0 };
  }

  if (!user.encryptedAccessToken) {
    logger.warn({ userId, username: user.username }, 'User has no encrypted GitHub access token, skipping');
    await UserRepository.updateSyncStatus(userId, 'failed', {
      error: 'No GitHub access token configured',
    });
    return { success: false, xp: 0 };
  }

  let plainToken: string;
  try {
    plainToken = decryptToken(user.encryptedAccessToken);
  } catch (decryptErr) {
    logger.error({ err: decryptErr, userId }, 'Failed to decrypt user GitHub access token');
    await UserRepository.updateSyncStatus(userId, 'failed', {
      error: 'Invalid or corrupted access token',
    });
    return { success: false, xp: 0 };
  }

  // Set user sync status to syncing
  await UserRepository.updateSyncStatus(userId, 'syncing', {
    startedAt: new Date(),
    error: null,
  });

  try {
    const ghService = new GitHubService({ auth: plainToken });

    // Fetch user profile, authored repositories, and public activity
    const aggregated = await ghService.getUserAggregatedData(user.username);

    // Extract contribution dates for streak analysis
    const contributionDates = aggregated.recentActivity
      .map((item) => {
        try {
          return new Date(item.createdAt).toISOString().split('T')[0];
        } catch {
          return null;
        }
      })
      .filter((d): d is string => Boolean(d));

    // Calculate commit counts, PRs, and issues from public activities
    let pushCommits = 0;
    let pullRequests = 0;
    let mergedPRs = 0;
    let issues = 0;

    for (const act of aggregated.recentActivity) {
      if (act.type === 'PushEvent') {
        pushCommits += act.payload?.commitsCount || 1;
      } else if (act.type === 'PullRequestEvent') {
        pullRequests += 1;
        if (act.payload?.action === 'closed' || act.payload?.isMerged) {
          mergedPRs += 1;
        }
      } else if (act.type === 'IssuesEvent') {
        issues += 1;
      }
    }

    // Baseline commit calculation: activity push events + repos baseline
    const totalCommits = Math.max(pushCommits, aggregated.repositories.length * 5);
    const totalPRs = Math.max(pullRequests, 0);
    const totalMergedPRs = Math.max(mergedPRs, 0);
    const totalIssues = Math.max(issues, 0);
    const totalRepos = Math.max(user.username ? aggregated.repositories.length : 0, aggregated.stats.publicRepos || 0);
    const totalStars = aggregated.stats.totalStars || 0;
    const totalFollowers = aggregated.user.followers || 0;

    const rawStats: RawStatsInput = {
      commits: totalCommits,
      pullRequests: totalPRs,
      mergedPullRequests: totalMergedPRs,
      issues: totalIssues,
      repositories: totalRepos,
      stars: totalStars,
      contributionDays: contributionDates.length,
    };

    // Calculate deterministic game profile using pure engine (GitHub-derived raw base XP)
    const calculatedProfile = calculateGameProfile(rawStats, {
      contributionDates,
    });

    // Idempotent upsert into GithubStats
    await GithubStatsRepository.upsertStats(userId, {
      commits: totalCommits,
      pullRequests: totalPRs,
      mergedPullRequests: totalMergedPRs,
      issues: totalIssues,
      repositories: totalRepos,
      stars: totalStars,
      followers: totalFollowers,
      contributionDays: calculatedProfile.streak.totalActiveDays,
      currentStreak: calculatedProfile.streak.currentStreak,
      longestStreak: calculatedProfile.streak.longestStreak,
      languages: aggregated.stats.languages,
      activityHistory: contributionDates.map((date) => ({ date, count: 1 })),
    });

    // --- Phase 9 Quests Evaluation ---
    const dailyPeriod = getDailyQuestPeriod();
    const weeklyPeriod = getWeeklyQuestPeriod();

    const dailyQuests = getQuestsForPeriod('daily', dailyPeriod.periodKey);
    const weeklyQuests = getQuestsForPeriod('weekly', weeklyPeriod.periodKey);

    const activePeriodsAndQuests = [
      { period: dailyPeriod, quests: dailyQuests },
      { period: weeklyPeriod, quests: weeklyQuests },
    ];

    for (const { period, quests } of activePeriodsAndQuests) {
      const existingProgress = await QuestProgressRepository.getUserQuestProgress(userId, [period.periodKey]);
      const progressMap = new Map(existingProgress.map((p) => [p.questId, p]));

      for (const quest of quests) {
        const progressResult = calculateQuestProgress(quest, aggregated.recentActivity, period);
        const existing = progressMap.get(quest.id);

        await QuestProgressRepository.upsertProgress({
          userId,
          questId: quest.id,
          questType: quest.type,
          periodKey: period.periodKey,
          progress: progressResult.progress,
          target: quest.target,
          completed: progressResult.completed,
          rewardXP: quest.rewardXP,
        });

        if (progressResult.completed && !existing?.rewardGranted) {
          await QuestProgressRepository.grantReward(userId, quest.id, period.periodKey);
          await ProgressionEventRepository.recordEvent({
            userId,
            type: 'QUEST_COMPLETED',
            eventKey: `quest_${quest.id}_${period.periodKey}`,
            metadata: {
              questId: quest.id,
              questType: quest.type,
              periodKey: period.periodKey,
              title: quest.name,
              xpGained: quest.rewardXP,
            },
          });
        }
      }
    }

    // --- Calculate Combined XP, Level, and Tier ---
    const totalQuestXP = await QuestProgressRepository.getTotalUserQuestXP(userId);
    const githubXP = calculatedProfile.xp;
    const totalLifetimeXP = calculateTotalLifetimeXp(githubXP, totalQuestXP);
    const totalLevel = calculateLevel(totalLifetimeXP);
    const totalTier = calculateTier(totalLevel, totalLifetimeXP);

    // Fetch existing GameProfile to detect milestone transitions
    const previousProfile = await GameProfileRepository.findByUserId(userId);

    if (previousProfile) {
      // Check Level Up milestone
      if (totalLevel > previousProfile.level) {
        await ProgressionEventRepository.recordEvent({
          userId,
          type: 'LEVEL_UP',
          eventKey: `level_up_${totalLevel}`,
          metadata: {
            previousLevel: previousProfile.level,
            newLevel: totalLevel,
          },
        });
      }

      // Check Tier Up milestone
      if (totalTier !== previousProfile.tier) {
        await ProgressionEventRepository.recordEvent({
          userId,
          type: 'TIER_UP',
          eventKey: `tier_up_${totalTier}`,
          metadata: {
            previousTier: previousProfile.tier,
            newTier: totalTier,
          },
        });
      }

      // Check Achievement Unlocks
      const prevAchievements = new Set(previousProfile.achievements || []);
      for (const achId of calculatedProfile.achievements) {
        if (!prevAchievements.has(achId)) {
          await ProgressionEventRepository.recordEvent({
            userId,
            type: 'ACHIEVEMENT_UNLOCKED',
            eventKey: `ach_${achId}`,
            metadata: {
              achievementId: achId,
            },
          });
        }
      }
    }

    // Record participation in active season if one is running
    let seasonXP = totalLifetimeXP;
    const activeSeason = await SeasonRepository.findActiveSeason();
    if (activeSeason) {
      const seasonParticipant = await SeasonRepository.recordSyncParticipation(
        activeSeason._id.toString(),
        userId,
        totalLifetimeXP
      );
      seasonXP = seasonParticipant.seasonXP;
    }

    // Idempotent upsert into GameProfile
    await GameProfileRepository.upsertProfile(userId, {
      xp: totalLifetimeXP,
      githubXP,
      questXP: totalQuestXP,
      level: totalLevel,
      tier: totalTier,
      seasonXP,
      stats: calculatedProfile.stats,
      achievements: calculatedProfile.achievements,
    });

    // Update User sync status to completed
    await UserRepository.updateSyncStatus(userId, 'completed', {
      completedAt: new Date(),
      error: null,
    });

    // Invalidate Redis leaderboard and public profile cache
    await invalidateLeaderboardCache(user.username);

    const duration = Date.now() - startTime;
    logger.info(
      {
        userId,
        username: user.username,
        xp: totalLifetimeXP,
        githubXP,
        questXP: totalQuestXP,
        level: totalLevel,
        tier: totalTier,
        durationMs: duration,
      },
      'GitHub user sync completed successfully'
    );

    return { success: true, xp: totalLifetimeXP };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    const status = err instanceof GitHubError ? err.status : (err as { status?: number })?.status;

    // 1. Authentication / Expired Token Failure -> Non-retryable
    if (err instanceof GitHubAuthenticationError || status === 401) {
      const authMessage = 'GitHub authorization expired or revoked. Please sign in again to reconnect.';
      logger.warn({ userId, status: 401 }, `Authentication failure during sync: ${authMessage}`);
      await UserRepository.updateSyncStatus(userId, 'failed', {
        error: authMessage,
      });
      return { success: false, xp: 0 };
    }

    // 2. Resource Not Found -> Non-retryable
    if (err instanceof GitHubNotFoundError || status === 404) {
      const notFoundMessage = 'GitHub profile or repository not found.';
      logger.warn({ userId, status: 404 }, `Resource not found during sync: ${notFoundMessage}`);
      await UserRepository.updateSyncStatus(userId, 'failed', {
        error: notFoundMessage,
      });
      return { success: false, xp: 0 };
    }

    // 3. Explicit Forbidden -> Non-retryable
    if ((err instanceof GitHubForbiddenError || status === 403) && !(err instanceof GitHubRateLimitError)) {
      const forbiddenMessage = 'GitHub API access forbidden.';
      logger.warn({ userId, status: 403 }, `Access forbidden during sync: ${forbiddenMessage}`);
      await UserRepository.updateSyncStatus(userId, 'failed', {
        error: forbiddenMessage,
      });
      return { success: false, xp: 0 };
    }

    // 4. Rate Limiting -> Retryable with backoff
    if (err instanceof GitHubRateLimitError || status === 429) {
      logger.warn({ userId, status: 429 }, 'GitHub API Rate Limit exceeded. Will retry automatically.');
      await UserRepository.updateSyncStatus(userId, 'failed', {
        error: 'GitHub API Rate Limit exceeded. Will retry automatically.',
      });
      throw err;
    }

    // 5. Transient Network / Server / Unknown Error -> Retryable
    logger.error({ err, userId }, `GitHub user sync failed: ${errorMsg}`);
    await UserRepository.updateSyncStatus(userId, 'failed', {
      error: errorMsg,
    });
    throw err;
  }
}

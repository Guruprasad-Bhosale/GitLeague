import pino from 'pino';
import {
  SeasonRepository,
  SeasonResultRepository,
  SeasonParticipantModel,
  UserModel,
  GameProfileModel,
  ProgressionEventRepository,
  SeasonModel,
} from '@gitleague/database';
import {
  sortSeasonParticipantsDeterministically,
} from '@gitleague/game-engine';
import { ISeasonResult, LeagueTier } from '@gitleague/types';
import { Redis } from 'ioredis';
import { redisConfig } from '../config/redis.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

/**
 * Invalidate Redis cache keys associated with seasons and leaderboards
 */
async function invalidateSeasonCaches(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const redis = new Redis({
      ...redisConfig,
      connectTimeout: 500,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    redis.on('error', () => {});
    await redis.connect();
    await Promise.race([
      Promise.all([
        redis.del('gitleague:seasons:list'),
        redis.del('gitleague:seasons:current'),
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);
    redis.disconnect();
  } catch {
    // Non-blocking if Redis is unreachable
  }
}


/**
 * Main idempotent season lifecycle execution function
 */
export async function processSeasonLifecycle(
  referenceDate: Date = new Date()
): Promise<{ activated: string[]; completed: string[] }> {
  const activated: string[] = [];
  const completed: string[] = [];

  logger.info({ referenceDate: referenceDate.toISOString() }, '🔄 Running Season Lifecycle Processor');

  // ==========================================
  // 1. Process Season Completions
  // ==========================================
  const activeSeasonsToComplete = await SeasonRepository.getActiveSeasonsToComplete(referenceDate);

  for (const season of activeSeasonsToComplete) {
    logger.info({ seasonSlug: season.slug, seasonNumber: season.seasonNumber }, '⏳ Finalizing expired active season');

    // Atomic update from active -> completed to prevent concurrent double-finalization
    const completedSeason = await SeasonRepository.completeSeason(season._id.toString());
    if (!completedSeason) {
      logger.warn({ seasonSlug: season.slug }, 'Season was already transitioned by another worker, skipping');
      continue;
    }

    const seasonIdStr = season._id.toString();

    // Query all participants in this season
    const participants = await SeasonParticipantModel.find({ seasonId: seasonIdStr }).lean();

    if (participants.length > 0) {
      const userIds = participants.map((p) => p.userId);

      // Load user identity (country, college) and game profiles (level, tier) in bulk
      const [users, gameProfiles] = await Promise.all([
        UserModel.find({
          $or: [
            { _id: { $in: userIds } },
            { githubId: { $in: userIds } },
          ],
        }).lean(),
        GameProfileModel.find({ userId: { $in: userIds } }).lean(),
      ]);

      const userMap = new Map(users.map((u) => [u._id.toString(), u]));
      const userGithubMap = new Map(users.map((u) => [u.githubId, u]));
      const profileMap = new Map(gameProfiles.map((gp) => [gp.userId, gp]));

      const enrichedParticipants = participants.map((p) => {
        const u = userMap.get(p.userId) || userGithubMap.get(p.userId);
        const gp = profileMap.get(p.userId);

        return {
          userId: p.userId,
          seasonXP: p.seasonXP,
          level: gp?.level || 1,
          tier: (gp?.tier || 'BRONZE') as LeagueTier,
          country: u?.location || null,
          collegeId: u?.collegeId || null,
        };
      });

      // Deterministic ranking sorting: seasonXP DESC -> level DESC -> userId ASC
      const rankedParticipants = sortSeasonParticipantsDeterministically(enrichedParticipants);

      const seasonResults: ISeasonResult[] = rankedParticipants.map((p, idx) => ({
        seasonId: seasonIdStr,
        userId: p.userId,
        finalRank: idx + 1,
        finalXP: p.seasonXP,
        finalLevel: p.level,
        finalTier: p.tier,
        country: p.country,
        collegeId: p.collegeId,
        finalizedAt: referenceDate,
      }));

      // Bulk write immutable results
      await SeasonResultRepository.bulkCreateResults(seasonResults);
      logger.info({ seasonSlug: season.slug, count: seasonResults.length }, '✅ Season results persisted successfully');

      // Record progression events & check personal bests
      for (const res of seasonResults) {
        // 1. Record SEASON_COMPLETED event
        await ProgressionEventRepository.recordEvent({
          userId: res.userId,
          type: 'SEASON_COMPLETED',
          eventKey: `season_completed_${seasonIdStr}`,
          metadata: {
            seasonId: seasonIdStr,
            seasonSlug: season.slug,
            seasonName: season.name,
            finalRank: res.finalRank,
            finalXP: res.finalXP,
            finalLevel: res.finalLevel,
            finalTier: res.finalTier,
          },
          occurredAt: referenceDate,
        });

        // 2. Check and record SEASON_PERSONAL_BEST
        try {
          const pastHistory = await SeasonResultRepository.getUserSeasonHistory(res.userId);
          const pastCompleted = pastHistory.filter((h) => h.season.slug !== season.slug);

          if (pastCompleted.length > 0) {
            const prevBestRank = Math.min(...pastCompleted.map((h) => h.finalRank));
            if (res.finalRank < prevBestRank) {
              await ProgressionEventRepository.recordEvent({
                userId: res.userId,
                type: 'SEASON_PERSONAL_BEST',
                eventKey: `season_pb_rank_${seasonIdStr}`,
                metadata: {
                  metric: 'season_rank',
                  previousValue: prevBestRank,
                  newValue: res.finalRank,
                  seasonSlug: season.slug,
                },
                occurredAt: referenceDate,
              });
            }

            const prevBestXP = Math.max(...pastCompleted.map((h) => h.finalXP));
            if (res.finalXP > prevBestXP) {
              await ProgressionEventRepository.recordEvent({
                userId: res.userId,
                type: 'SEASON_PERSONAL_BEST',
                eventKey: `season_pb_xp_${seasonIdStr}`,
                metadata: {
                  metric: 'season_xp',
                  previousValue: prevBestXP,
                  newValue: res.finalXP,
                  seasonSlug: season.slug,
                },
                occurredAt: referenceDate,
              });
            }
          }
        } catch {
          // Graceful handling if PB check fails
        }
      }

    }

    completed.push(season.slug);
  }

  // ==========================================
  // 2. Process Season Activations
  // ==========================================
  // Only activate a new season if no season is currently active
  const currentlyActiveSeason = await SeasonRepository.findActiveSeason();

  if (!currentlyActiveSeason) {
    const upcomingToActivate = await SeasonRepository.getUpcomingSeasonsToActivate(referenceDate);
    if (upcomingToActivate.length > 0) {
      const nextSeason = upcomingToActivate[0];
      logger.info({ seasonSlug: nextSeason.slug, seasonNumber: nextSeason.seasonNumber }, '🚀 Activating upcoming season');

      try {
        const activatedSeason = await SeasonRepository.activateSeason(nextSeason._id.toString());
        if (activatedSeason) {
          activated.push(activatedSeason.slug);
          logger.info({ seasonSlug: activatedSeason.slug }, '🌟 Season activated successfully');
        }
      } catch (err: any) {
        logger.error({ err: err.message, seasonSlug: nextSeason.slug }, 'Failed to activate season');
      }
    }
  }

  // If any season state changed, invalidate caches
  if (activated.length > 0 || completed.length > 0) {
    await invalidateSeasonCaches();
  }

  return { activated, completed };
}

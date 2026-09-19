import {
  GameProfileRepository,
  SeasonRepository,
  FriendshipRepository,
  RankSnapshotRepository,
  UserModel,
  LeaderboardQueryOptions,
} from '@gitleague/database';
import {
  ILeaderboardEntry,
  IPaginatedResponse,
  IPersonalRankResponse,
  ILeaderboardQuery,
  LeaderboardType,
} from '@gitleague/types';
import { calculateRankMovement } from '@gitleague/game-engine';
import { CacheService } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../errors/app-error.js';

export class LeaderboardService {
  /**
   * Query deterministic paginated leaderboard with Redis caching, scope resolution, and season support
   */
  static async getLeaderboard(
    query: ILeaderboardQuery,
    authUserId?: string
  ): Promise<IPaginatedResponse<ILeaderboardEntry>> {
    const scope = query.scope || 'global';
    const season = query.season || 'all';
    const tier = query.tier || 'all';
    const search = query.search || 'none';
    const page = query.page || 1;
    const limit = query.limit || 50;

    let country = 'all';
    let friendUserIds: string[] | null = null;
    let collegeId: string | null = null;

    if (scope === 'country') {
      country = query.country || 'India';
    } else if (scope === 'friends') {
      if (!authUserId) {
        throw AppError.unauthorized('Authentication required to access friends leaderboard');
      }
      const acceptedFriendIds = await FriendshipRepository.getFriendUserIds(authUserId);
      friendUserIds = [authUserId, ...acceptedFriendIds];
    } else if (scope === 'college') {
      if (!authUserId) {
        throw AppError.unauthorized('Authentication required to access college leaderboard');
      }
      const authUser = await UserModel.findById(authUserId);
      if (!authUser || !authUser.collegeId) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
            scopeNote: 'COLLEGE_NOT_SET',
          },
        };
      }
      collegeId = authUser.collegeId;
    }

    // Build unique isolated cache key
    let cacheKey = '';
    if (scope === 'friends') {
      cacheKey = `leaderboard:friends:${authUserId}:s_${season}:${tier}:${search}:p${page}:l${limit}`;
    } else if (scope === 'college') {
      cacheKey = `leaderboard:college:${collegeId}:s_${season}:${tier}:${search}:p${page}:l${limit}`;
    } else {
      cacheKey = `leaderboard:${scope}:${country}:s_${season}:${tier}:${search}:p${page}:l${limit}`;
    }

    // Try Redis cache first
    const cached = await CacheService.get<IPaginatedResponse<ILeaderboardEntry>>(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Leaderboard cache hit');
      return cached;
    }

    const queryOptions: LeaderboardQueryOptions = {
      scope: query.scope,
      country: query.scope === 'country' ? country : undefined,
      page,
      limit,
      tier: query.tier,
      search: query.search,
      userIds: friendUserIds || undefined,
      collegeId: collegeId || undefined,
    };

    let result: IPaginatedResponse<ILeaderboardEntry>;
    const isSeasonLeaderboard = Boolean(query.season && query.season !== 'all' && query.season !== 'global');
    const leaderboardType: LeaderboardType = isSeasonLeaderboard ? 'season' : 'lifetime';

    // If season filter requested, query specific season participant leaderboard
    if (isSeasonLeaderboard) {
      let targetSeasonId: string | null = null;
      if (query.season === 'current') {
        const active = await SeasonRepository.findActiveSeason();
        targetSeasonId = active ? active._id.toString() : null;
      } else {
        const seasonDoc = await SeasonRepository.findBySlug(query.season!);
        targetSeasonId = seasonDoc ? seasonDoc._id.toString() : null;
      }

      if (targetSeasonId) {
        result = await SeasonRepository.getSeasonLeaderboard(targetSeasonId, queryOptions);
      } else {
        result = {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
    } else {
      result = await GameProfileRepository.getLeaderboard(queryOptions);
    }

    // Attach bulk rank movement if data is present
    if (result.data.length > 0) {
      const userIds = result.data.map((entry) => entry.userId);
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const prevPeriodKey = yesterday.toISOString().split('T')[0];

      try {
        const prevSnapshots = await RankSnapshotRepository.getPreviousRankSnapshots(
          userIds,
          leaderboardType,
          scope,
          prevPeriodKey
        );

        for (const entry of result.data) {
          const prevRank = prevSnapshots.get(entry.userId);
          const movementObj = calculateRankMovement(prevRank, entry.rank);
          entry.rankMovement = movementObj.direction === 'up' ? movementObj.movement : movementObj.direction === 'down' ? -movementObj.movement : 0;
          entry.rankDirection = movementObj.direction;
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to compute rank movement for leaderboard entries');
      }
    }

    // Cache result in Redis for 60 seconds
    await CacheService.set(cacheKey, result, 60);

    return result;
  }

  /**
   * Retrieve personal rank and percentile for the authenticated user within requested scope
   */
  static async getUserRank(
    userId: string,
    query?: { scope?: string; country?: string; season?: string }
  ): Promise<IPersonalRankResponse | null> {
    const scope = query?.scope || 'global';
    let friendUserIds: string[] | undefined;
    let collegeId: string | null = null;

    if (scope === 'friends') {
      const acceptedFriendIds = await FriendshipRepository.getFriendUserIds(userId);
      friendUserIds = [userId, ...acceptedFriendIds];
    } else if (scope === 'college') {
      const user = await UserModel.findById(userId);
      if (!user || !user.collegeId) {
        return null;
      }
      collegeId = user.collegeId;
    }

    if (query?.season && query.season !== 'all' && query.season !== 'global') {
      let targetSeasonId: string | null = null;
      if (query.season === 'current') {
        const active = await SeasonRepository.findActiveSeason();
        targetSeasonId = active ? active._id.toString() : null;
      } else {
        const seasonDoc = await SeasonRepository.findBySlug(query.season);
        targetSeasonId = seasonDoc ? seasonDoc._id.toString() : null;
      }

      if (targetSeasonId) {
        const seasonRank = await SeasonRepository.getParticipantSeasonRank(targetSeasonId, userId, {
          scope,
          userIds: friendUserIds,
          collegeId,
        });
        if (!seasonRank) return null;

        const profile = await GameProfileRepository.findByUserId(userId);

        const percentile =
          seasonRank.totalParticipants > 1
            ? Number((((seasonRank.totalParticipants - seasonRank.seasonRank) / seasonRank.totalParticipants) * 100).toFixed(1))
            : 100.0;

        return {
          currentRank: seasonRank.seasonRank,
          previousRank: seasonRank.seasonRank,
          rankMovement: 0,
          totalParticipants: seasonRank.totalParticipants,
          percentile,
          xp: profile?.xp || 0,
          seasonXP: seasonRank.seasonXP,
          level: profile?.level || 1,
          tier: profile?.tier || 'BRONZE',
        };
      }
    }

    return GameProfileRepository.getUserRank(userId, {
      scope: query?.scope,
      country: query?.scope === 'country' ? query.country || 'India' : undefined,
      userIds: friendUserIds,
      collegeId,
    });
  }

  /**
   * Invalidate friend leaderboard caches for specified users
   */
  static async invalidateFriendLeaderboards(userIds: string[]): Promise<void> {
    for (const id of userIds) {
      await CacheService.invalidatePattern(`leaderboard:friends:${id}:*`);
    }
  }

  /**
   * Invalidate college leaderboard cache for a specific college
   */
  static async invalidateCollegeLeaderboard(collegeId: string): Promise<void> {
    await CacheService.invalidatePattern(`leaderboard:college:${collegeId}:*`);
  }
}

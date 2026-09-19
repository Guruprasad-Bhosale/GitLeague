import mongoose, { PipelineStage } from 'mongoose';
import { GameProfileModel, IGameProfileDocument } from '../models/game-profile.model.js';
import { UserModel } from '../models/user.model.js';
import {
  IGameProfile,
  ILeaderboardEntry,
  IPaginatedResponse,
  IPersonalRankResponse,
  LeagueTier,
} from '@gitleague/types';

export interface LeaderboardQueryOptions {
  scope?: 'global' | 'country' | 'region' | 'college' | 'friends';
  country?: string;
  page?: number;
  limit?: number;
  tier?: LeagueTier;
  search?: string;
  userIds?: string[];
  collegeId?: string | null;
}

export class GameProfileRepository {
  /**
   * Upsert game profile idempotently with calculated XP, level, tier, and achievements
   */
  static async upsertProfile(userId: string, profile: Partial<IGameProfile>): Promise<IGameProfileDocument> {
    const existing = await GameProfileModel.findOne({ userId });

    const updatePayload: Record<string, unknown> = {
      ...profile,
      userId,
      updatedAt: new Date(),
    };

    if (existing) {
      // Preserve or calculate previous rank
      updatePayload.previousRank = existing.currentRank || 0;
    }

    const doc = await GameProfileModel.findOneAndUpdate(
      { userId },
      { $set: updatePayload },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return doc;
  }

  /**
   * Find game profile by user ID
   */
  static async findByUserId(userId: string): Promise<IGameProfileDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return GameProfileModel.findOne({ userId });
  }

  /**
   * Retrieve deterministic paginated leaderboard of GitLeague participants
   */
  static async getLeaderboard(options: LeaderboardQueryOptions = {}): Promise<IPaginatedResponse<ILeaderboardEntry>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;

    const basePipeline: PipelineStage[] = [];

    // Filter by tier if specified
    if (options.tier) {
      basePipeline.push({ $match: { tier: options.tier } });
    }

    // Filter by specific user IDs (e.g. Friends scope)
    if (options.scope === 'friends') {
      const allowedUserIds = options.userIds || [];
      basePipeline.push({ $match: { userId: { $in: allowedUserIds } } });
    }

    // Lookup user profile details
    basePipeline.push(
      {
        $lookup: {
          from: 'users',
          let: { uId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: '$_id' }, '$$uId'] },
                    { $eq: ['$githubId', '$$uId'] },
                  ],
                },
              },
            },
          ],
          as: 'user',
        },
      },
      { $unwind: '$user' }
    );

    // Filter by scope/country/college or search
    const userMatch: Record<string, unknown> = {};
    if (options.scope === 'country' && options.country) {
      userMatch['user.location'] = { $regex: options.country, $options: 'i' };
    }
    if (options.scope === 'college') {
      userMatch['user.collegeId'] = options.collegeId || '__NO_COLLEGE__';
    }
    if (options.search) {
      const searchRegex = { $regex: options.search, $options: 'i' };
      userMatch.$or = [{ 'user.username': searchRegex }, { 'user.displayName': searchRegex }];
    }
    if (Object.keys(userMatch).length > 0) {
      basePipeline.push({ $match: userMatch });
    }

    // Lookup GitHub Stats for commit / PR / streak info
    basePipeline.push(
      {
        $lookup: {
          from: 'githubstats',
          let: { uId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$uId'] },
              },
            },
          ],
          as: 'statsDoc',
        },
      },
      {
        $unwind: {
          path: '$statsDoc',
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    // Deterministic tie-breaking sort: XP descending, Level descending, userId ascending
    basePipeline.push({
      $sort: {
        xp: -1,
        level: -1,
        userId: 1,
      },
    });

    const facetStage: PipelineStage.Facet = {
      $facet: {
        totalCount: [{ $count: 'total' }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    };

    const [facetResults] = await GameProfileModel.aggregate<{
      totalCount: Array<{ total: number }>;
      items: Array<{
        userId: string;
        xp: number;
        level: number;
        tier: LeagueTier;
        currentRank?: number;
        previousRank?: number;
        seasonXP?: number;
        user: {
          username: string;
          displayName?: string | null;
          avatarUrl: string;
        };
        statsDoc?: {
          commits?: number;
          pullRequests?: number;
          currentStreak?: number;
        };
      }>;
    }>([...basePipeline, facetStage]);

    const total = facetResults?.totalCount?.[0]?.total || 0;
    const items = facetResults?.items || [];

    const totalPages = Math.ceil(total / limit) || 1;

    interface RawAggregatedItem {
      userId: string;
      xp: number;
      level: number;
      tier: LeagueTier;
      currentRank?: number;
      previousRank?: number;
      seasonXP?: number;
      user: {
        username: string;
        displayName?: string | null;
        avatarUrl: string;
      };
      statsDoc?: {
        commits?: number;
        pullRequests?: number;
        currentStreak?: number;
      };
    }

    const leaderboardEntries: ILeaderboardEntry[] = (items as RawAggregatedItem[]).map((doc, idx) => {
      const calculatedRank = skip + idx + 1;
      const prevRank = doc.previousRank || 0;
      const rankMovement = prevRank > 0 ? prevRank - calculatedRank : 0;

      return {
        rank: calculatedRank,
        rankMovement,
        userId: doc.userId,
        username: doc.user.username,
        displayName: doc.user.displayName ?? null,
        avatarUrl: doc.user.avatarUrl,
        level: doc.level,
        tier: doc.tier,
        xp: doc.xp,
        seasonXP: doc.seasonXP ?? doc.xp,
        commits: doc.statsDoc?.commits ?? 0,
        pullRequests: doc.statsDoc?.pullRequests ?? 0,
        currentStreak: doc.statsDoc?.currentStreak ?? 0,
      };
    });

    return {
      data: leaderboardEntries,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Scalably compute an authenticated user's exact rank and percentile within scope
   */
  static async getUserRank(
    userId: string,
    options: { scope?: string; country?: string; userIds?: string[]; collegeId?: string | null } = {}
  ): Promise<IPersonalRankResponse | null> {
    const userProfile = await GameProfileModel.findOne({ userId });
    if (!userProfile) {
      return null;
    }

    let scopedUserIds: string[] | null = null;

    if (options.scope === 'country' && options.country) {
      const matchedUsers = await UserModel.find(
        { location: { $regex: options.country, $options: 'i' } },
        { _id: 1 }
      ).lean();
      scopedUserIds = matchedUsers.map((u) => u._id.toString());
    } else if (options.scope === 'friends') {
      scopedUserIds = options.userIds || [userId];
    } else if (options.scope === 'college') {
      if (!options.collegeId) {
        return null;
      }
      const matchedUsers = await UserModel.find(
        { collegeId: options.collegeId },
        { _id: 1 }
      ).lean();
      scopedUserIds = matchedUsers.map((u) => u._id.toString());
    }

    const baseFilter: Record<string, unknown> = {};
    if (scopedUserIds) {
      baseFilter.userId = { $in: scopedUserIds };
    }

    const totalParticipants = await GameProfileModel.countDocuments(baseFilter);
    if (totalParticipants === 0) {
      return null;
    }

    // Count participants with higher rank (XP desc, Level desc, userId asc)
    const higherRankCount = await GameProfileModel.countDocuments({
      ...baseFilter,
      $or: [
        { xp: { $gt: userProfile.xp } },
        { xp: userProfile.xp, level: { $gt: userProfile.level } },
        { xp: userProfile.xp, level: userProfile.level, userId: { $lt: userProfile.userId } },
      ],
    });

    const currentRank = higherRankCount + 1;
    const prevRank = userProfile.previousRank || currentRank;
    const rankMovement = prevRank > 0 ? prevRank - currentRank : 0;
    const percentile =
      totalParticipants > 1
        ? Number((((totalParticipants - currentRank) / totalParticipants) * 100).toFixed(1))
        : 100.0;

    return {
      currentRank,
      previousRank: prevRank,
      rankMovement,
      totalParticipants,
      percentile,
      xp: userProfile.xp,
      seasonXP: userProfile.seasonXP || userProfile.xp,
      level: userProfile.level,
      tier: userProfile.tier,
    };
  }

  /**
   * Aggregate unlocked counts for all achievements across eligible users to calculate rarity
   */
  static async getAchievementDistribution(): Promise<{ totalEligible: number; distribution: Record<string, number> }> {
    if (mongoose.connection.readyState === 0) {
      return { totalEligible: 0, distribution: {} };
    }
    const totalEligible = await GameProfileModel.countDocuments();
    if (totalEligible === 0) {
      return { totalEligible: 0, distribution: {} };
    }

    const res = await GameProfileModel.aggregate<{ _id: string; unlockedCount: number }>([
      { $unwind: '$achievements' },
      { $match: { 'achievements.isUnlocked': true } },
      { $group: { _id: '$achievements.id', unlockedCount: { $sum: 1 } } },
    ]);

    const distribution: Record<string, number> = {};
    for (const item of res) {
      distribution[item._id] = item.unlockedCount;
    }

    return { totalEligible, distribution };
  }
}


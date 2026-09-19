import { PipelineStage } from 'mongoose';
import { SeasonResultModel, ISeasonResultDocument } from '../models/season-result.model.js';
import { SeasonModel } from '../models/season.model.js';
import {
  ISeasonResult,
  IUserSeasonHistoryItem,
  ILeaderboardEntry,
  IPaginatedResponse,
  LeagueTier,
} from '@gitleague/types';
import { LeaderboardQueryOptions } from './game-profile.repository.js';

export class SeasonResultRepository {
  /**
   * Bulk upserts final immutable season results atomically.
   */
  static async bulkCreateResults(results: ISeasonResult[]): Promise<number> {
    if (!results || results.length === 0) {
      return 0;
    }

    const operations = results.map((res) => ({
      updateOne: {
        filter: { seasonId: res.seasonId, userId: res.userId },
        update: {
          $set: {
            finalRank: res.finalRank,
            finalXP: res.finalXP,
            finalLevel: res.finalLevel,
            finalTier: res.finalTier,
            country: res.country ?? null,
            collegeId: res.collegeId ?? null,
            finalizedAt: res.finalizedAt || new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await SeasonResultModel.bulkWrite(operations, { ordered: false });
    return (result.upsertedCount || 0) + (result.modifiedCount || 0);
  }

  /**
   * Retrieves paginated immutable leaderboard from finalized SeasonResults.
   */
  static async getSeasonLeaderboard(
    seasonId: string,
    options: LeaderboardQueryOptions = {}
  ): Promise<IPaginatedResponse<ILeaderboardEntry>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;

    const basePipeline: PipelineStage[] = [{ $match: { seasonId } }];

    // Filter by specific user IDs (e.g. Friends scope)
    if (options.scope === 'friends') {
      const allowedUserIds = options.userIds || [];
      basePipeline.push({ $match: { userId: { $in: allowedUserIds } } });
    }

    // Lookup user identity details
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

    // Filter by country, college, or search query
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

    // Filter by tier if requested
    if (options.tier) {
      basePipeline.push({ $match: { finalTier: options.tier } });
    }

    // Lookup GitHub Stats for commit / PR / streak counts
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

    // Deterministic sort by finalRank ascending
    basePipeline.push({
      $sort: {
        finalRank: 1,
        userId: 1,
      },
    });

    const facetStage: PipelineStage.Facet = {
      $facet: {
        totalCount: [{ $count: 'total' }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    };

    const [facetResults] = await SeasonResultModel.aggregate<{
      totalCount: Array<{ total: number }>;
      items: Array<{
        userId: string;
        finalRank: number;
        finalXP: number;
        finalLevel: number;
        finalTier: LeagueTier;
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

    const leaderboardEntries: ILeaderboardEntry[] = items.map((doc) => ({
      rank: doc.finalRank,
      rankMovement: 0,
      userId: doc.userId,
      username: doc.user.username,
      displayName: doc.user.displayName ?? null,
      avatarUrl: doc.user.avatarUrl,
      level: doc.finalLevel,
      tier: doc.finalTier,
      xp: doc.finalXP,
      seasonXP: doc.finalXP,
      commits: doc.statsDoc?.commits ?? 0,
      pullRequests: doc.statsDoc?.pullRequests ?? 0,
      currentStreak: doc.statsDoc?.currentStreak ?? 0,
    }));

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
   * Retrieves all completed seasons a user participated in, ordered by newest season first.
   */
  static async getUserSeasonHistory(userId: string): Promise<IUserSeasonHistoryItem[]> {
    const results = await SeasonResultModel.find({ userId }).sort({ finalizedAt: -1 });
    if (!results || results.length === 0) {
      return [];
    }

    const seasonIds = results.map((r) => r.seasonId);
    const seasons = await SeasonModel.find({ _id: { $in: seasonIds } });
    const seasonMap = new Map(seasons.map((s) => [s._id.toString(), s]));

    const history: IUserSeasonHistoryItem[] = [];

    for (const res of results) {
      const season = seasonMap.get(res.seasonId.toString());
      if (season) {
        history.push({
          season: {
            id: season._id.toString(),
            seasonNumber: season.seasonNumber,
            name: season.name,
            slug: season.slug,
            status: season.status,
            startDate: season.startDate,
            endDate: season.endDate,
          },
          finalRank: res.finalRank,
          finalXP: res.finalXP,
          finalLevel: res.finalLevel,
          finalTier: res.finalTier as LeagueTier,
          completedAt: res.finalizedAt,
        });
      }
    }

    // Sort newest season first (by seasonNumber DESC)
    return history.sort((a, b) => b.season.seasonNumber - a.season.seasonNumber);
  }

  /**
   * Fetch a single user result for a specific season.
   */
  static async getUserSeasonResult(
    seasonId: string,
    userId: string
  ): Promise<ISeasonResultDocument | null> {
    return SeasonResultModel.findOne({ seasonId, userId });
  }

  /**
   * Count results for a finalized season.
   */
  static async countResults(seasonId: string): Promise<number> {
    return SeasonResultModel.countDocuments({ seasonId });
  }
}

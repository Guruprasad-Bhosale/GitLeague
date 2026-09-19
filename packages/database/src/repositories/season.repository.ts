import { PipelineStage } from 'mongoose';
import { SeasonModel, ISeasonDocument } from '../models/season.model.js';
import { SeasonParticipantModel, ISeasonParticipantDocument } from '../models/season-participant.model.js';
import { SeasonResultRepository } from './season-result.repository.js';
import {
  ILeaderboardEntry,
  IPaginatedResponse,
  LeagueTier,
  SeasonStatus,
} from '@gitleague/types';
import { LeaderboardQueryOptions } from './game-profile.repository.js';

export interface ICreateSeasonData {
  seasonNumber: number;
  name: string;
  slug: string;
  startDate: Date;
  endDate: Date;
  status?: SeasonStatus;
}

export class SeasonRepository {
  /**
   * Strictly read-only query for the active competitive season
   */
  static async findActiveSeason(): Promise<ISeasonDocument | null> {
    return SeasonModel.findOne({
      status: 'active',
      isActive: true,
    });
  }

  /**
   * Read-only lookup of season by unique URL slug
   */
  static async findBySlug(slug: string): Promise<ISeasonDocument | null> {
    return SeasonModel.findOne({ slug: slug.toLowerCase().trim() });
  }

  /**
   * Read-only lookup of season by ID
   */
  static async findById(id: string): Promise<ISeasonDocument | null> {
    return SeasonModel.findById(id);
  }

  /**
   * List all historical and current seasons sorted chronologically descending
   */
  static async listSeasons(): Promise<ISeasonDocument[]> {
    return SeasonModel.find().sort({ seasonNumber: -1 });
  }

  /**
   * Find upcoming seasons whose startDate has arrived
   */
  static async getUpcomingSeasonsToActivate(refDate: Date = new Date()): Promise<ISeasonDocument[]> {
    return SeasonModel.find({
      status: 'upcoming',
      startDate: { $lte: refDate },
    }).sort({ startDate: 1 });
  }

  /**
   * Find active seasons whose endDate has passed
   */
  static async getActiveSeasonsToComplete(refDate: Date = new Date()): Promise<ISeasonDocument[]> {
    return SeasonModel.find({
      status: 'active',
      endDate: { $lte: refDate },
    }).sort({ endDate: 1 });
  }

  /**
   * Atomically activate an upcoming season ensuring only 1 season can be active
   */
  static async activateSeason(seasonId: string): Promise<ISeasonDocument | null> {
    // Check if any other season is currently active
    const activeSeason = await SeasonModel.findOne({
      _id: { $ne: seasonId },
      status: 'active',
      isActive: true,
    });

    if (activeSeason) {
      throw new Error(
        `Cannot activate season ${seasonId}: Season ${activeSeason.slug} is already active.`
      );
    }

    return SeasonModel.findOneAndUpdate(
      { _id: seasonId, status: 'upcoming' },
      { $set: { status: 'active', isActive: true, isArchived: false } },
      { new: true }
    );
  }

  /**
   * Atomically complete an active season
   */
  static async completeSeason(seasonId: string): Promise<ISeasonDocument | null> {
    return SeasonModel.findOneAndUpdate(
      { _id: seasonId, status: 'active' },
      { $set: { status: 'completed', isActive: false, isArchived: true } },
      { new: true }
    );
  }

  /**
   * Explicit season creation with lifecycle and single-active-season validation
   */
  static async createSeason(data: ICreateSeasonData): Promise<ISeasonDocument> {
    if (new Date(data.startDate).getTime() >= new Date(data.endDate).getTime()) {
      throw new Error('Season startDate must be strictly before endDate');
    }

    const status: SeasonStatus = data.status || 'upcoming';

    if (status === 'active') {
      const existingActive = await SeasonModel.findOne({ status: 'active', isActive: true });
      if (existingActive) {
        throw new Error(`Cannot create active season: Season ${existingActive.seasonNumber} (${existingActive.slug}) is already currently active`);
      }
    }

    const season = await SeasonModel.create({
      seasonNumber: data.seasonNumber,
      name: data.name,
      slug: data.slug.toLowerCase().trim(),
      startDate: data.startDate,
      endDate: data.endDate,
      status,
      isActive: status === 'active',
      isArchived: status === 'completed',
      participantsCount: 0,
    });

    return season;
  }

  /**
   * Ingest user participation and baseline lifetime XP safely for an active season
   */
  static async recordSyncParticipation(
    seasonId: string,
    userId: string,
    currentLifetimeXP: number
  ): Promise<ISeasonParticipantDocument> {
    let participant = await SeasonParticipantModel.findOne({ seasonId, userId });

    if (!participant) {
      participant = await SeasonParticipantModel.create({
        seasonId,
        userId,
        lifetimeXPAtSeasonStart: currentLifetimeXP,
        lifetimeXPAtLastSync: currentLifetimeXP,
        seasonXP: 0,
        joinedAt: new Date(),
      });

      // Increment season participant counter
      await SeasonModel.findByIdAndUpdate(seasonId, { $inc: { participantsCount: 1 } });
      return participant;
    }

    // Invariant: seasonXP is strictly the delta between current lifetime XP and baseline at season start
    const calculatedSeasonXP = Math.max(0, currentLifetimeXP - participant.lifetimeXPAtSeasonStart);

    participant.lifetimeXPAtLastSync = currentLifetimeXP;
    participant.seasonXP = calculatedSeasonXP;
    await participant.save();

    return participant;
  }

  /**
   * Retrieve deterministic paginated leaderboard of participants within a specific season.
   * If the season is completed, delegates directly to immutable SeasonResults.
   */
  static async getSeasonLeaderboard(
    seasonId: string,
    options: LeaderboardQueryOptions = {}
  ): Promise<IPaginatedResponse<ILeaderboardEntry>> {
    const season = await SeasonModel.findById(seasonId);
    if (season && season.status === 'completed') {
      return SeasonResultRepository.getSeasonLeaderboard(seasonId, options);
    }

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

    // Lookup GameProfile for level & tier
    basePipeline.push(
      {
        $lookup: {
          from: 'gameprofiles',
          let: { uId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$uId'] },
              },
            },
          ],
          as: 'gameProfile',
        },
      },
      {
        $unwind: {
          path: '$gameProfile',
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    // Filter by tier if requested
    if (options.tier) {
      basePipeline.push({ $match: { 'gameProfile.tier': options.tier } });
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

    // Deterministic tie-breaking sort: Season XP desc, Lifetime XP desc, userId asc
    basePipeline.push({
      $sort: {
        seasonXP: -1,
        lifetimeXPAtLastSync: -1,
        userId: 1,
      },
    });

    const facetStage: PipelineStage.Facet = {
      $facet: {
        totalCount: [{ $count: 'total' }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    };

    const [facetResults] = await SeasonParticipantModel.aggregate<{
      totalCount: Array<{ total: number }>;
      items: Array<{
        userId: string;
        seasonXP: number;
        lifetimeXPAtLastSync: number;
        user: {
          username: string;
          displayName?: string | null;
          avatarUrl: string;
        };
        gameProfile?: {
          level?: number;
          tier?: LeagueTier;
          xp?: number;
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

    const leaderboardEntries: ILeaderboardEntry[] = items.map((doc, idx) => {
      const calculatedRank = skip + idx + 1;
      return {
        rank: calculatedRank,
        rankMovement: 0,
        userId: doc.userId,
        username: doc.user.username,
        displayName: doc.user.displayName ?? null,
        avatarUrl: doc.user.avatarUrl,
        level: doc.gameProfile?.level || 1,
        tier: doc.gameProfile?.tier || 'BRONZE',
        xp: doc.gameProfile?.xp || doc.lifetimeXPAtLastSync || 0,
        seasonXP: doc.seasonXP,
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
   * Dynamically derive user's rank in a specific season
   */
  static async getParticipantSeasonRank(
    seasonId: string,
    userId: string,
    options: { scope?: string; userIds?: string[]; collegeId?: string | null } = {}
  ): Promise<{ seasonRank: number; seasonXP: number; totalParticipants: number } | null> {
    const participant = await SeasonParticipantModel.findOne({ seasonId, userId });
    if (!participant) {
      return null;
    }

    const baseFilter: Record<string, unknown> = { seasonId };

    if (options.scope === 'friends' && options.userIds) {
      baseFilter.userId = { $in: options.userIds };
    } else if (options.scope === 'college' && options.collegeId) {
      const matchedUsers = await SeasonParticipantModel.db.collection('users').find(
        { collegeId: options.collegeId },
        { projection: { _id: 1 } }
      ).toArray();
      const collegeUserIds = matchedUsers.map((u) => u._id.toString());
      baseFilter.userId = { $in: collegeUserIds };
    }

    const totalParticipants = await SeasonParticipantModel.countDocuments(baseFilter);
    if (totalParticipants === 0) {
      return null;
    }

    const higherRankCount = await SeasonParticipantModel.countDocuments({
      ...baseFilter,
      $or: [
        { seasonXP: { $gt: participant.seasonXP } },
        { seasonXP: participant.seasonXP, lifetimeXPAtLastSync: { $gt: participant.lifetimeXPAtLastSync } },
        { seasonXP: participant.seasonXP, lifetimeXPAtLastSync: participant.lifetimeXPAtLastSync, userId: { $lt: participant.userId } },
      ],
    });

    return {
      seasonRank: higherRankCount + 1,
      seasonXP: participant.seasonXP,
      totalParticipants,
    };
  }
}

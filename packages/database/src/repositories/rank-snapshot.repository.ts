import mongoose from 'mongoose';
import { RankSnapshotModel, IRankSnapshotDocument } from '../models/rank-snapshot.model.js';
import { LeaderboardType } from '@gitleague/types';

export class RankSnapshotRepository {
  /**
   * Bulk capture and upsert rank snapshots for a leaderboard period
   */
  static async captureLeaderboardSnapshot(
    leaderboardType: LeaderboardType,
    scope: string,
    periodKey: string,
    entries: Array<{ userId: string; rank: number; xp: number }>,
    seasonId: string | null = null
  ): Promise<number> {
    if (entries.length === 0 || mongoose.connection.readyState === 0) return 0;

    const operations = entries.map((entry) => ({
      updateOne: {
        filter: {
          userId: entry.userId,
          leaderboardType,
          scope,
          periodKey,
        },
        update: {
          $set: {
            rank: entry.rank,
            xp: entry.xp,
            seasonId,
            capturedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await RankSnapshotModel.bulkWrite(operations);
    return (result.upsertedCount || 0) + (result.modifiedCount || 0);
  }

  /**
   * Bulk retrieve previous snapshot ranks for a set of userIds without N+1 queries
   */
  static async getPreviousRankSnapshots(
    userIds: string[],
    leaderboardType: LeaderboardType,
    scope: string,
    currentPeriodKey: string
  ): Promise<Map<string, number>> {
    if (userIds.length === 0 || mongoose.connection.readyState === 0) return new Map();

    // Query snapshots for these users strictly prior to currentPeriodKey
    const snapshots = await RankSnapshotModel.find({
      userId: { $in: userIds },
      leaderboardType,
      scope,
      periodKey: { $ne: currentPeriodKey },
    })
      .sort({ periodKey: -1, capturedAt: -1 })
      .lean();

    const rankMap = new Map<string, number>();
    for (const snap of snapshots) {
      if (!rankMap.has(snap.userId)) {
        rankMap.set(snap.userId, snap.rank);
      }
    }

    return rankMap;
  }

  /**
   * Single user lookup for previous rank snapshot
   */
  static async getSinglePreviousSnapshot(
    userId: string,
    leaderboardType: LeaderboardType,
    scope: string,
    currentPeriodKey: string
  ): Promise<number | null> {
    if (mongoose.connection.readyState === 0) return null;

    const snapshot = await RankSnapshotModel.findOne({
      userId,
      leaderboardType,
      scope,
      periodKey: { $ne: currentPeriodKey },
    })
      .sort({ periodKey: -1, capturedAt: -1 })
      .lean();

    return snapshot ? snapshot.rank : null;
  }

  /**
   * Retrieves real persisted rank snapshots for a user over time.
   * Preserves historical gaps without interpolating fake data.
   */
  static async getUserRankHistory(
    userId: string,
    leaderboardType: LeaderboardType = 'lifetime',
    scope: string = 'global',
    seasonId?: string | null,
    limit: number = 50
  ): Promise<Array<{ periodKey: string; rank: number; xp: number; capturedAt: Date }>> {
    if (mongoose.connection.readyState === 0) return [];

    const filter: Record<string, unknown> = {
      userId,
      leaderboardType,
      scope,
    };

    if (seasonId) {
      filter.seasonId = seasonId;
    }

    const snapshots = await RankSnapshotModel.find(filter)
      .sort({ capturedAt: 1 })
      .limit(limit)
      .lean();

    return snapshots.map((s) => ({
      periodKey: s.periodKey,
      rank: s.rank,
      xp: s.xp,
      capturedAt: new Date(s.capturedAt),
    }));
  }
}



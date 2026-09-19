import { GithubStatsModel, IGithubStatsDocument } from '../models/github-stats.model.js';
import { IGitHubStats } from '@gitleague/types';

export class GithubStatsRepository {
  /**
   * Upsert normalized GitHub activity statistics for a user idempotently
   */
  static async upsertStats(userId: string, stats: Partial<IGitHubStats>): Promise<IGithubStatsDocument> {
    const updatePayload = {
      ...stats,
      userId,
      lastSyncedAt: new Date(),
    };

    const doc = await GithubStatsModel.findOneAndUpdate(
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
   * Find GitHub statistics by user ID
   */
  static async findByUserId(userId: string): Promise<IGithubStatsDocument | null> {
    return GithubStatsModel.findOne({ userId });
  }
}

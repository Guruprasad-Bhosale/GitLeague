import { Request, Response, NextFunction } from 'express';
import { UsernameParamSchema, RankHistoryQuerySchema } from '@gitleague/validation';
import { UserModel, SeasonRepository, SeasonResultRepository, RankSnapshotRepository } from '@gitleague/database';
import { AppError } from '../errors/app-error.js';

export class UserSeasonsController {
  /**
   * GET /api/v1/users/:username/seasons
   * Retrieves all completed seasons the specified user participated in, ordered newest first.
   */
  static async getUserSeasons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramValidation = UsernameParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        throw AppError.badRequest('Invalid GitHub username', paramValidation.error.format());
      }

      const { username } = paramValidation.data;
      const user = await UserModel.findOne({ username: username.toLowerCase().trim() });
      if (!user) {
        throw AppError.notFound(`Developer @${username} not found`);
      }

      const userId = user._id.toString();
      const history = await SeasonResultRepository.getUserSeasonHistory(userId);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/users/:username/rank-history
   * Retrieves persisted rank snapshots for a user across lifetime or season leaderboards.
   * Gaps are preserved as-is without fake interpolation.
   */
  static async getUserRankHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramValidation = UsernameParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        throw AppError.badRequest('Invalid GitHub username', paramValidation.error.format());
      }

      const queryValidation = RankHistoryQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        throw AppError.badRequest('Invalid rank history query parameters', queryValidation.error.format());
      }

      const { username } = paramValidation.data;
      const { leaderboardType, scope, season } = queryValidation.data;

      const user = await UserModel.findOne({ username: username.toLowerCase().trim() });
      if (!user) {
        throw AppError.notFound(`Developer @${username} not found`);
      }

      const userId = user._id.toString();
      let seasonId: string | null = null;

      if (season) {
        const seasonDoc = await SeasonRepository.findBySlug(season);
        if (!seasonDoc) {
          throw AppError.notFound(`Season "${season}" not found`);
        }
        seasonId = seasonDoc._id.toString();
      }

      const snapshots = await RankSnapshotRepository.getUserRankHistory(
        userId,
        leaderboardType,
        scope,
        seasonId
      );

      res.status(200).json({
        success: true,
        data: {
          userId,
          username: user.username,
          leaderboardType,
          scope,
          seasonSlug: season || null,
          snapshots,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

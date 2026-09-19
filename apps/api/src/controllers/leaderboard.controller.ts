import { Request, Response, NextFunction } from 'express';
import { LeaderboardQuerySchema } from '@gitleague/validation';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { AppError } from '../errors/app-error.js';

export class LeaderboardController {
  /**
   * GET /api/v1/leaderboard
   * Retrieve paginated leaderboard participants with scope filtering, season support, and deterministic sorting
   */
  static async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = LeaderboardQuerySchema.safeParse(req.query);
      if (!validation.success) {
        throw AppError.badRequest('Invalid leaderboard query parameters', validation.error.format());
      }

      const query = validation.data;

      // Region scope placeholder (friends and college are now active)
      if (query.scope === 'region') {
        res.status(200).json({
          success: true,
          data: [],
          meta: {
            total: 0,
            page: query.page,
            limit: query.limit,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
            scopeNote: 'Region leaderboard scope is scheduled for future expansion',
          },
        });
        return;
      }

      const result = await LeaderboardService.getLeaderboard(query, req.user?.id);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/leaderboard/me
   * Retrieve authenticated user's exact ranking, percentile, and rank movement within scope
   */
  static async getMyRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const scope = typeof req.query.scope === 'string' ? req.query.scope : 'global';
      const country = typeof req.query.country === 'string' ? req.query.country : undefined;
      const season = typeof req.query.season === 'string' ? req.query.season : undefined;

      const rankData = await LeaderboardService.getUserRank(req.user.id, { scope, country, season });

      if (!rankData) {
        res.status(200).json({
          success: true,
          data: null,
          message: 'User has not yet synchronized GitHub activity or has no rank in this scope',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: rankData,
      });
    } catch (err) {
      next(err);
    }
  }
}

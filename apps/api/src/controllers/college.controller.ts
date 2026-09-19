import { Request, Response, NextFunction } from 'express';
import {
  CollegeRepository,
  UserModel,
} from '@gitleague/database';
import {
  SelectCollegeSchema,
  CollegeSearchQuerySchema,
} from '@gitleague/validation';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { CacheService } from '../lib/redis.js';
import { AppError } from '../errors/app-error.js';

export class CollegeController {
  /**
   * Search colleges in the verified directory
   */
  static async searchColleges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = CollegeSearchQuerySchema.safeParse(req.query);
      const search = parsed.success ? parsed.data.search : undefined;
      const limit = parsed.success ? parsed.data.limit : 20;

      const colleges = await CollegeRepository.searchColleges(search, limit);

      res.json({
        success: true,
        data: colleges.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          shortName: c.shortName || null,
          slug: c.slug,
          city: c.city,
          state: c.state,
          country: c.country,
          verified: c.verified,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update the authenticated user's college affiliation
   */
  static async setUserCollege(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = SelectCollegeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid college selection payload', parsed.error.format());
      }

      const { collegeId } = parsed.data;
      let collegeDoc = null;

      if (collegeId) {
        collegeDoc = await CollegeRepository.findById(collegeId);
        if (!collegeDoc) {
          throw AppError.notFound('Selected college does not exist in the directory');
        }
      }

      const user = await UserModel.findById(authUser.id);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      const oldCollegeId = user.collegeId;
      user.collegeId = collegeId ? collegeDoc!._id.toString() : null;
      await user.save();

      // Invalidate relevant college leaderboard and profile caches
      if (oldCollegeId) {
        await LeaderboardService.invalidateCollegeLeaderboard(oldCollegeId);
      }
      if (user.collegeId) {
        await LeaderboardService.invalidateCollegeLeaderboard(user.collegeId);
      }
      await CacheService.invalidatePattern(`profile:${user.username.toLowerCase()}*`);

      res.json({
        success: true,
        data: {
          collegeId: user.collegeId,
          college: collegeDoc
            ? {
                id: collegeDoc._id.toString(),
                name: collegeDoc.name,
                shortName: collegeDoc.shortName || null,
                slug: collegeDoc.slug,
                city: collegeDoc.city,
                state: collegeDoc.state,
                country: collegeDoc.country,
                verified: collegeDoc.verified,
              }
            : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

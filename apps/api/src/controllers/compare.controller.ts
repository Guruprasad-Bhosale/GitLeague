import { Request, Response, NextFunction } from 'express';
import { UserProfileRepository } from '@gitleague/database';
import { UsernameParamSchema } from '@gitleague/validation';
import { ICompareResponse, ICompareUserStat } from '@gitleague/types';
import { AppError } from '../errors/app-error.js';

export class CompareController {
  /**
   * Compare authenticated user with another developer side-by-side
   */
  static async compareUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = UsernameParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid target username');
      }

      const targetUsername = parsed.data.username;

      // Query both profiles in parallel
      const [profileA, profileB] = await Promise.all([
        UserProfileRepository.getPublicProfileByUsername(authUser.username),
        UserProfileRepository.getPublicProfileByUsername(targetUsername),
      ]);

      if (!profileA) {
        throw AppError.notFound('Your developer profile is not yet initialized or synced');
      }

      if (!profileB) {
        throw AppError.notFound(`Developer "${targetUsername}" not found or not synced with GitLeague`);
      }

      const statA: ICompareUserStat = {
        userId: profileA.userId,
        username: profileA.username,
        displayName: profileA.displayName,
        avatarUrl: profileA.avatarUrl,
        level: profileA.level,
        tier: profileA.tier,
        xp: profileA.xp,
        globalRank: profileA.globalRank,
        countryRank: profileA.countryRank,
        college: profileA.college,
        stats: profileA.stats,
        currentStreak: profileA.currentStreak,
        longestStreak: profileA.longestStreak,
        commits: profileA.commits,
        pullRequests: profileA.pullRequests,
        issues: profileA.issues,
        repositories: profileA.repositories,
        stars: profileA.stars,
        achievementsCount: profileA.achievements.filter((a) => a.isUnlocked).length,
      };

      const statB: ICompareUserStat = {
        userId: profileB.userId,
        username: profileB.username,
        displayName: profileB.displayName,
        avatarUrl: profileB.avatarUrl,
        level: profileB.level,
        tier: profileB.tier,
        xp: profileB.xp,
        globalRank: profileB.globalRank,
        countryRank: profileB.countryRank,
        college: profileB.college,
        stats: profileB.stats,
        currentStreak: profileB.currentStreak,
        longestStreak: profileB.longestStreak,
        commits: profileB.commits,
        pullRequests: profileB.pullRequests,
        issues: profileB.issues,
        repositories: profileB.repositories,
        stars: profileB.stars,
        achievementsCount: profileB.achievements.filter((a) => a.isUnlocked).length,
      };

      const compareData: ICompareResponse = {
        userA: statA,
        userB: statB,
      };

      res.json({
        success: true,
        data: compareData,
      });
    } catch (err) {
      next(err);
    }
  }
}

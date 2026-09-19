import { Request, Response, NextFunction } from 'express';
import { UsernameParamSchema } from '@gitleague/validation';
import { UserProfileRepository, FriendshipRepository } from '@gitleague/database';
import { IUserProfile } from '@gitleague/types';
import { CacheService } from '../lib/redis.js';
import { AppError } from '../errors/app-error.js';

export class UserProfileController {
  /**
   * GET /api/v1/users/:username/profile
   * Return safe, public developer profile with progression, ranks, RPG stats, and social relations
   */
  static async getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = UsernameParamSchema.safeParse(req.params);
      if (!validation.success) {
        throw AppError.badRequest('Invalid GitHub username', validation.error.format());
      }

      const { username } = validation.data;
      const currentAuthUserId = req.user?.id;
      const cacheKey = `profile:${username.toLowerCase()}`;

      let profile = await CacheService.get<IUserProfile>(cacheKey);

      if (!profile) {
        profile = await UserProfileRepository.getPublicProfileByUsername(username);
        if (!profile) {
          throw AppError.notFound(`Developer @${username} has not joined GitLeague or has no synchronized game data`);
        }
        // Cache public profile for 60 seconds
        await CacheService.set(cacheKey, profile, 60);
      }

      // If user is authenticated, compute dynamic friendshipStatus for this specific caller
      if (currentAuthUserId && profile.userId) {
        const relation = await FriendshipRepository.getFriendshipStatus(currentAuthUserId, profile.userId);
        profile = {
          ...profile,
          friendshipStatus: relation.status,
        };
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }
}

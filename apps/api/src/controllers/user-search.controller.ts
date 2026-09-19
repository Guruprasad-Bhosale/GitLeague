import { Request, Response, NextFunction } from 'express';
import {
  UserModel,
  GameProfileModel,
  CollegeModel,
  FriendshipRepository,
} from '@gitleague/database';
import { UserSearchQuerySchema } from '@gitleague/validation';
import { IUserSearchResult, LeagueTier, ICollegeSummary } from '@gitleague/types';
import { AppError } from '../errors/app-error.js';

export class UserSearchController {
  /**
   * Search GitLeague participants by username or display name
   */
  static async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = UserSearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid search parameters', parsed.error.format());
      }

      const { q, limit } = parsed.data;
      const currentAuthUserId = req.user?.id;

      const searchRegex = new RegExp(q.trim(), 'i');

      // Only search GitLeague participants who have completed a sync
      const matchedUsers = await UserModel.find({
        $and: [
          {
            $or: [
              { username: searchRegex },
              { displayName: searchRegex },
            ],
          },
          { syncStatus: 'completed' },
        ],
      })
        .limit(limit)
        .lean();

      if (matchedUsers.length === 0) {
        res.json({
          success: true,
          data: [],
        });
        return;
      }

      const userIds = matchedUsers.map((u) => u._id.toString());
      const collegeIds = matchedUsers
        .map((u) => u.collegeId)
        .filter((c): c is string => Boolean(c));

      const [profiles, colleges] = await Promise.all([
        GameProfileModel.find({ userId: { $in: userIds } }).lean(),
        collegeIds.length > 0 ? CollegeModel.find({ _id: { $in: collegeIds } }).lean() : Promise.resolve([]),
      ]);

      const profileMap = new Map(profiles.map((p) => [p.userId, p]));
      const collegeMap = new Map(colleges.map((c) => [c._id.toString(), c]));

      // Query friendship status in parallel if caller is authenticated
      const results: IUserSearchResult[] = await Promise.all(
        matchedUsers.map(async (user) => {
          const uId = user._id.toString();
          const profile = profileMap.get(uId);

          let collegeSummary: ICollegeSummary | null = null;
          if (user.collegeId && collegeMap.has(user.collegeId)) {
            const c = collegeMap.get(user.collegeId)!;
            collegeSummary = {
              id: c._id.toString(),
              name: c.name,
              shortName: c.shortName || null,
              slug: c.slug,
              city: c.city,
              state: c.state,
              country: c.country,
              verified: c.verified,
            };
          }

          let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self' = 'none';
          let friendRequestId: string | undefined;

          if (currentAuthUserId) {
            const statusInfo = await FriendshipRepository.getFriendshipStatus(currentAuthUserId, uId);
            friendshipStatus = statusInfo.status;
            friendRequestId = statusInfo.requestId;
          }

          return {
            userId: uId,
            username: user.username,
            displayName: user.displayName || null,
            avatarUrl: user.avatarUrl,
            level: profile?.level || 1,
            tier: profile?.tier || ('BRONZE' as LeagueTier),
            xp: profile?.xp || 0,
            college: collegeSummary,
            friendshipStatus,
            friendRequestId,
          };
        })
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }
}

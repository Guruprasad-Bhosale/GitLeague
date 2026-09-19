import { Request, Response, NextFunction } from 'express';
import {
  FriendshipRepository,
  UserModel,
} from '@gitleague/database';
import {
  FriendRequestSchema,
  FriendRequestIdParamSchema,
  FriendUserIdParamSchema,
  PaginationQuerySchema,
} from '@gitleague/validation';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { AppError } from '../errors/app-error.js';

export class FriendController {
  /**
   * Send a friend request to another developer
   */
  static async sendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = FriendRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid friend request parameters', parsed.error.format());
      }

      const { recipientUsername, recipientId } = parsed.data;
      let targetUser = null;

      if (recipientUsername) {
        targetUser = await UserModel.findOne({ username: recipientUsername.toLowerCase().trim() });
      } else if (recipientId) {
        targetUser = await UserModel.findById(recipientId);
      }

      if (!targetUser) {
        throw AppError.notFound('Target developer not found on GitLeague');
      }

      const targetUserId = (targetUser._id ? targetUser._id.toString() : targetUser.id) as string;

      if (authUser.id === targetUserId) {
        throw AppError.badRequest('You cannot send a friend request to yourself');
      }

      const friendship = await FriendshipRepository.sendRequest(authUser.id, targetUserId);

      // Invalidate cached friend leaderboards if relationship became accepted immediately
      if (friendship.status === 'accepted') {
        await LeaderboardService.invalidateFriendLeaderboards([authUser.id, targetUserId]);
      }

      res.status(201).json({
        success: true,
        data: {
          id: friendship._id.toString(),
          status: friendship.status,
          recipientUsername: targetUser.username,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('already friends') || err.message.includes('already sent') || err.message.includes('yourself'))) {
        return next(AppError.badRequest(err.message));
      }
      next(err);
    }
  }

  /**
   * List pending friend requests for the current user
   */
  static async getRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const requests = await FriendshipRepository.getPendingRequests(authUser.id);

      res.json({
        success: true,
        data: requests,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Accept an incoming friend request
   */
  static async acceptRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = FriendRequestIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid friend request ID');
      }

      const friendship = await FriendshipRepository.acceptRequest(parsed.data.id, authUser.id);

      // Invalidate friend leaderboard caches for both developers
      await LeaderboardService.invalidateFriendLeaderboards([authUser.id, friendship.requesterId]);

      res.json({
        success: true,
        data: {
          id: friendship._id.toString(),
          status: 'accepted',
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('Unauthorized')) {
          return next(AppError.forbidden(err.message));
        }
        if (err.message.includes('not found')) {
          return next(AppError.notFound(err.message));
        }
      }
      next(err);
    }
  }

  /**
   * Reject an incoming friend request
   */
  static async rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = FriendRequestIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid friend request ID');
      }

      const friendship = await FriendshipRepository.rejectRequest(parsed.data.id, authUser.id);

      res.json({
        success: true,
        data: {
          id: friendship._id.toString(),
          status: 'rejected',
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('Unauthorized')) {
          return next(AppError.forbidden(err.message));
        }
        if (err.message.includes('not found')) {
          return next(AppError.notFound(err.message));
        }
      }
      next(err);
    }
  }

  /**
   * Remove a friendship
   */
  static async removeFriend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = FriendUserIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid target user ID');
      }

      const targetUserId = parsed.data.userId;

      await FriendshipRepository.removeFriend(authUser.id, targetUserId);

      // Invalidate friend leaderboard caches for both users
      await LeaderboardService.invalidateFriendLeaderboards([authUser.id, targetUserId]);

      res.json({
        success: true,
        message: 'Friend relationship removed successfully',
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('Unauthorized')) {
          return next(AppError.forbidden(err.message));
        }
        if (err.message.includes('not found')) {
          return next(AppError.notFound(err.message));
        }
      }
      next(err);
    }
  }

  /**
   * List paginated friends of the authenticated user
   */
  static async getFriends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw AppError.unauthorized();
      }

      const parsed = PaginationQuerySchema.safeParse(req.query);
      const page = parsed.success ? parsed.data.page : 1;
      const limit = parsed.success ? parsed.data.limit : 20;

      const result = await FriendshipRepository.getFriends(authUser.id, page, limit);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }
}

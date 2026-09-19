import mongoose from 'mongoose';
import { FriendshipModel, IFriendshipDocument } from '../models/friendship.model.js';
import { UserModel } from '../models/user.model.js';
import { GameProfileModel } from '../models/game-profile.model.js';
import {
  IFriendRequest,
  IFriendSummary,
  IPaginatedResponse,
  LeagueTier,
} from '@gitleague/types';

export class FriendshipRepository {
  /**
   * Helper to normalize user ID pairs deterministically
   */
  static normalizePair(userA: string, userB: string): { pairA: string; pairB: string } {
    const sorted = [userA, userB].sort();
    return { pairA: sorted[0], pairB: sorted[1] };
  }

  /**
   * Send a friend request from requester to recipient
   */
  static async sendRequest(requesterId: string, recipientId: string): Promise<IFriendshipDocument> {
    if (requesterId === recipientId) {
      throw new Error('Cannot send a friend request to yourself');
    }

    // Verify recipient user exists
    const recipient = await UserModel.findById(recipientId);
    if (!recipient) {
      throw new Error('Recipient user not found');
    }

    const { pairA, pairB } = this.normalizePair(requesterId, recipientId);

    const existing = await FriendshipModel.findOne({ pairA, pairB });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('You are already friends with this developer');
      }

      if (existing.status === 'pending') {
        if (existing.requesterId === requesterId) {
          throw new Error('Friend request already sent and pending');
        } else {
          // Recipient already sent a request to requester -> automatically accept
          existing.status = 'accepted';
          existing.acceptedAt = new Date();
          await existing.save();
          return existing;
        }
      }

      // If rejected, re-open the request
      existing.requesterId = requesterId;
      existing.recipientId = recipientId;
      existing.status = 'pending';
      existing.acceptedAt = null;
      await existing.save();
      return existing;
    }

    const friendship = await FriendshipModel.create({
      requesterId,
      recipientId,
      pairA,
      pairB,
      status: 'pending',
    });

    return friendship;
  }

  /**
   * Retrieve all incoming pending friend requests for a user
   */
  static async getPendingRequests(recipientId: string): Promise<IFriendRequest[]> {
    const pendingFriendships = await FriendshipModel.find({
      recipientId,
      status: 'pending',
    }).sort({ createdAt: -1 });

    if (pendingFriendships.length === 0) {
      return [];
    }

    const requesterIds = pendingFriendships.map((f) => f.requesterId);

    const [users, gameProfiles] = await Promise.all([
      UserModel.find({ _id: { $in: requesterIds } }).lean(),
      GameProfileModel.find({ userId: { $in: requesterIds } }).lean(),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const profileMap = new Map(gameProfiles.map((p) => [p.userId, p]));

    return pendingFriendships
      .map((friendship) => {
        const user = userMap.get(friendship.requesterId);
        if (!user) return null;
        const profile = profileMap.get(friendship.requesterId);

        return {
          id: friendship._id.toString(),
          requesterId: friendship.requesterId,
          requesterUsername: user.username,
          requesterDisplayName: user.displayName || null,
          requesterAvatarUrl: user.avatarUrl,
          requesterLevel: profile?.level || 1,
          requesterTier: profile?.tier || ('BRONZE' as LeagueTier),
          createdAt: friendship.createdAt,
        };
      })
      .filter((r): r is IFriendRequest => r !== null);
  }

  /**
   * Accept an incoming friend request
   */
  static async acceptRequest(requestId: string, recipientId: string): Promise<IFriendshipDocument> {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new Error('Invalid friend request ID');
    }

    const friendship = await FriendshipModel.findById(requestId);
    if (!friendship) {
      throw new Error('Friend request not found');
    }

    if (friendship.recipientId !== recipientId) {
      throw new Error('Unauthorized to accept this friend request');
    }

    if (friendship.status === 'accepted') {
      return friendship;
    }

    friendship.status = 'accepted';
    friendship.acceptedAt = new Date();
    await friendship.save();

    return friendship;
  }

  /**
   * Reject an incoming friend request
   */
  static async rejectRequest(requestId: string, recipientId: string): Promise<IFriendshipDocument> {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new Error('Invalid friend request ID');
    }

    const friendship = await FriendshipModel.findById(requestId);
    if (!friendship) {
      throw new Error('Friend request not found');
    }

    if (friendship.recipientId !== recipientId) {
      throw new Error('Unauthorized to reject this friend request');
    }

    friendship.status = 'rejected';
    await friendship.save();

    return friendship;
  }

  /**
   * Remove/delete a friend relationship
   */
  static async removeFriend(userId: string, targetUserId: string): Promise<void> {
    const { pairA, pairB } = this.normalizePair(userId, targetUserId);

    const friendship = await FriendshipModel.findOne({ pairA, pairB });
    if (!friendship || friendship.status !== 'accepted') {
      throw new Error('Friendship not found');
    }

    if (friendship.pairA !== userId && friendship.pairB !== userId) {
      throw new Error('Unauthorized to remove this friendship');
    }

    await FriendshipModel.deleteOne({ _id: friendship._id });
  }

  /**
   * Retrieve array of user IDs for all accepted friends of a user
   */
  static async getFriendUserIds(userId: string): Promise<string[]> {
    const friendships = await FriendshipModel.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    }).lean();

    return friendships.map((f) => (f.requesterId === userId ? f.recipientId : f.requesterId));
  }

  /**
   * Get paginated list of friends with public profile summary
   */
  static async getFriends(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IPaginatedResponse<IFriendSummary>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const total = await FriendshipModel.countDocuments({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    });

    const friendships = await FriendshipModel.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    })
      .sort({ acceptedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    if (friendships.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit) || 1,
          hasNextPage: false,
          hasPrevPage: safePage > 1,
        },
      };
    }

    const friendUserIds = friendships.map((f) => (f.requesterId === userId ? f.recipientId : f.requesterId));

    const [users, gameProfiles] = await Promise.all([
      UserModel.find({ _id: { $in: friendUserIds } }).lean(),
      GameProfileModel.find({ userId: { $in: friendUserIds } }).lean(),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const profileMap = new Map(gameProfiles.map((p) => [p.userId, p]));

    const friendsList: IFriendSummary[] = friendships
      .map((f) => {
        const friendId = f.requesterId === userId ? f.recipientId : f.requesterId;
        const user = userMap.get(friendId);
        if (!user) return null;
        const profile = profileMap.get(friendId);

        return {
          userId: friendId,
          username: user.username,
          displayName: user.displayName || null,
          avatarUrl: user.avatarUrl,
          level: profile?.level || 1,
          tier: profile?.tier || ('BRONZE' as LeagueTier),
          xp: profile?.xp || 0,
          globalRank: profile?.currentRank || 0,
          friendshipId: f._id.toString(),
          friendsSince: f.acceptedAt || f.createdAt,
        };
      })
      .filter((friend): friend is IFriendSummary => friend !== null);

    return {
      data: friendsList,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1,
        hasNextPage: safePage < Math.ceil(total / safeLimit),
        hasPrevPage: safePage > 1,
      },
    };
  }

  /**
   * Determine friendship status between two users
   */
  static async getFriendshipStatus(
    userA: string,
    userB: string
  ): Promise<{ status: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self'; requestId?: string }> {
    if (userA === userB) {
      return { status: 'self' };
    }

    const { pairA, pairB } = this.normalizePair(userA, userB);
    const friendship = await FriendshipModel.findOne({ pairA, pairB });

    if (!friendship || friendship.status === 'rejected') {
      return { status: 'none' };
    }

    if (friendship.status === 'accepted') {
      return { status: 'friends', requestId: friendship._id.toString() };
    }

    if (friendship.status === 'pending') {
      if (friendship.requesterId === userA) {
        return { status: 'pending_sent', requestId: friendship._id.toString() };
      } else {
        return { status: 'pending_received', requestId: friendship._id.toString() };
      }
    }

    return { status: 'none' };
  }

  /**
   * Count total accepted friends for a user
   */
  static async countFriends(userId: string): Promise<number> {
    return FriendshipModel.countDocuments({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    });
  }
}

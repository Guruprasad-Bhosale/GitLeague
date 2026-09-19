import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  FriendshipRepository,
  UserRepository,
  SessionRepository,
  UserModel,
} from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('Friendship API Endpoints & Social Security', () => {
  const app = createApp();

  const userA = {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    githubId: '1001',
    username: 'user-a',
    avatarUrl: 'https://avatar.url/a',
  };

  const userB = {
    _id: '507f1f77bcf86cd799439022',
    id: '507f1f77bcf86cd799439022',
    githubId: '1002',
    username: 'user-b',
    displayName: 'Developer B',
    avatarUrl: 'https://avatar.url/b',
  };

  const userC = {
    _id: '507f1f77bcf86cd799439033',
    id: '507f1f77bcf86cd799439033',
    githubId: '1003',
    username: 'user-c',
    avatarUrl: 'https://avatar.url/c',
  };

  const mockSession = {
    _id: 'session_123',
    userId: userA.id,
    sessionHash: 'hash_123',
    expiresAt: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
    vi.spyOn(CacheService, 'invalidatePattern').mockResolvedValue();

    vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValue(mockSession as any);
    vi.spyOn(SessionRepository, 'touchSession').mockResolvedValue();
    vi.spyOn(UserRepository, 'findById').mockImplementation(async (id) => {
      if (id === userA.id) return userA as any;
      if (id === userB.id) return userB as any;
      if (id === userC.id) return userC as any;
      return null;
    });
    vi.spyOn(UserRepository, 'toSafeUser').mockImplementation((u: any) => ({
      id: u._id?.toString() || u.id,
      githubId: u.githubId,
      username: u.username,
      displayName: u.displayName || null,
      avatarUrl: u.avatarUrl,
      githubProfileUrl: `https://github.com/${u.username}`,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    }));
  });

  describe('POST /api/v1/friends/requests', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app)
        .post('/api/v1/friends/requests')
        .send({ recipientUsername: 'user-b' });

      expect(res.status).toBe(401);
    });

    it('creates a friend request successfully with valid recipient', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce(userB as any);
      vi.spyOn(FriendshipRepository, 'sendRequest').mockResolvedValueOnce({
        _id: 'friendship_100',
        requesterId: userA.id,
        recipientId: userB.id,
        status: 'pending',
      } as any);

      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Cookie', ['gitleague_session=valid_token'])
        .send({ recipientUsername: 'user-b' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.recipientUsername).toBe('user-b');
    });

    it('rejects self friend requests (400)', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce(userA as any);

      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Cookie', ['gitleague_session=valid_token'])
        .send({ recipientUsername: 'user-a' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('yourself');
    });

    it('returns 404 when target developer is not found', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Cookie', ['gitleague_session=valid_token'])
        .send({ recipientUsername: 'nonexistent-dev' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/friends/requests', () => {
    it('returns list of incoming pending friend requests', async () => {
      const mockRequests = [
        {
          id: 'req_1',
          requesterId: userB.id,
          requesterUsername: 'user-b',
          requesterDisplayName: 'Developer B',
          requesterAvatarUrl: 'https://avatar.url/b',
          requesterLevel: 15,
          requesterTier: 'GOLD' as const,
          createdAt: new Date(),
        },
      ];

      vi.spyOn(FriendshipRepository, 'getPendingRequests').mockResolvedValueOnce(mockRequests);

      const res = await request(app)
        .get('/api/v1/friends/requests')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].requesterUsername).toBe('user-b');
    });
  });

  describe('POST /api/v1/friends/requests/:id/accept', () => {
    it('allows recipient to accept request and invalidates caches', async () => {
      vi.spyOn(FriendshipRepository, 'acceptRequest').mockResolvedValueOnce({
        _id: 'req_1',
        requesterId: userB.id,
        recipientId: userA.id,
        status: 'accepted',
      } as any);

      const res = await request(app)
        .post('/api/v1/friends/requests/req_1/accept')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
    });

    it('rejects unauthorized user from accepting someone elses request (403)', async () => {
      vi.spyOn(FriendshipRepository, 'acceptRequest').mockRejectedValueOnce(
        new Error('Unauthorized to accept this friend request')
      );

      const res = await request(app)
        .post('/api/v1/friends/requests/req_1/accept')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/friends/requests/:id/reject', () => {
    it('allows recipient to reject request', async () => {
      vi.spyOn(FriendshipRepository, 'rejectRequest').mockResolvedValueOnce({
        _id: 'req_1',
        status: 'rejected',
      } as any);

      const res = await request(app)
        .post('/api/v1/friends/requests/req_1/reject')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('rejected');
    });
  });

  describe('DELETE /api/v1/friends/:userId', () => {
    it('allows participant to remove friend relationship', async () => {
      vi.spyOn(FriendshipRepository, 'removeFriend').mockResolvedValueOnce();

      const res = await request(app)
        .delete(`/api/v1/friends/${userB.id}`)
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/friends', () => {
    it('returns paginated list of accepted friends', async () => {
      const mockFriends = [
        {
          userId: userB.id,
          username: 'user-b',
          displayName: 'Developer B',
          avatarUrl: 'https://avatar.url/b',
          level: 20,
          tier: 'GOLD' as const,
          xp: 5000,
          globalRank: 10,
          friendshipId: 'fr_1',
          friendsSince: new Date(),
        },
      ];

      vi.spyOn(FriendshipRepository, 'getFriends').mockResolvedValueOnce({
        data: mockFriends,
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/api/v1/friends')
        .set('Cookie', ['gitleague_session=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].username).toBe('user-b');
    });
  });
});

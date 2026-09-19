import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRepository,
  SessionRepository,
  OAuthStateRepository,
  UserModel,
  SessionModel,
  OAuthStateModel,
} from '../src/index.js';

describe('Database Repositories Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('UserRepository', () => {
    it('upserts a new GitHub user with normalized fields', async () => {
      const mockResult = {
        _id: '507f1f77bcf86cd799439011',
        githubId: '12345678',
        username: 'coder_pro',
        displayName: 'Coder Pro',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
        githubProfileUrl: 'https://github.com/coder_pro',
        email: 'pro@example.com',
        bio: 'Building systems',
        location: 'Remote',
        company: 'GitLeague',
        encryptedAccessToken: 'v1:iv:tag:cipher',
        lastLoginAt: new Date(),
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const spy = vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce(mockResult as any);

      const user = await UserRepository.upsertGitHubUser({
        githubId: '12345678',
        username: 'Coder_Pro',
        displayName: 'Coder Pro',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
        githubProfileUrl: 'https://github.com/coder_pro',
        email: 'pro@example.com',
        bio: 'Building systems',
        location: 'Remote',
        company: 'GitLeague',
        encryptedAccessToken: 'v1:iv:tag:cipher',
      });

      expect(spy).toHaveBeenCalledWith(
        { githubId: '12345678' },
        expect.objectContaining({
          $set: expect.objectContaining({
            username: 'coder_pro',
            displayName: 'Coder Pro',
            encryptedAccessToken: 'v1:iv:tag:cipher',
          }),
        }),
        expect.objectContaining({
          new: true,
          upsert: true,
        })
      );

      expect(user.username).toBe('coder_pro');
      expect(user.githubId).toBe('12345678');
    });

    it('toSafeUser strips all private properties and tokens', () => {
      const internalDoc = {
        _id: '507f1f77bcf86cd799439011',
        githubId: '12345678',
        username: 'coder_pro',
        displayName: 'Coder Pro',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
        githubProfileUrl: 'https://github.com/coder_pro',
        email: 'pro@example.com',
        bio: 'Building systems',
        location: 'Remote',
        company: 'GitLeague',
        encryptedAccessToken: 'v1:iv:tag:cipher',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        lastSyncedAt: null,
      };

      const safe = UserRepository.toSafeUser(internalDoc as any);

      expect(safe.id).toBe('507f1f77bcf86cd799439011');
      expect(safe.username).toBe('coder_pro');
      expect((safe as any).encryptedAccessToken).toBeUndefined();
      expect((safe as any)._id).toBeUndefined();
    });
  });

  describe('SessionRepository', () => {
    it('creates a session document with hash and expiration', async () => {
      const mockSession = {
        _id: 'sess_111',
        sessionHash: 'sha256_hash_123',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 100000),
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        lastUsedAt: new Date(),
      };

      const spy = vi.spyOn(SessionModel, 'create').mockResolvedValueOnce(mockSession as any);

      const session = await SessionRepository.createSession({
        sessionHash: 'sha256_hash_123',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: mockSession.expiresAt,
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      });

      expect(spy).toHaveBeenCalled();
      expect(session.sessionHash).toBe('sha256_hash_123');
      expect(session.userId).toBe('507f1f77bcf86cd799439011');
    });

    it('findSessionByHash only queries non-expired sessions', async () => {
      const spy = vi.spyOn(SessionModel, 'findOne').mockResolvedValueOnce(null);

      await SessionRepository.findSessionByHash('sha256_hash_123');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionHash: 'sha256_hash_123',
          expiresAt: expect.objectContaining({ $gt: expect.any(Date) }),
        })
      );
    });

    it('deleteSessionByHash removes session and returns true when deleted', async () => {
      vi.spyOn(SessionModel, 'deleteOne').mockResolvedValueOnce({ deletedCount: 1 } as any);

      const deleted = await SessionRepository.deleteSessionByHash('sha256_hash_123');
      expect(deleted).toBe(true);
    });
  });

  describe('OAuthStateRepository', () => {
    it('creates a state with TTL expiration', async () => {
      const spy = vi.spyOn(OAuthStateModel, 'create').mockResolvedValueOnce({} as any);

      await OAuthStateRepository.createState('state_random_xyz', 600);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'state_random_xyz',
          expiresAt: expect.any(Date),
        })
      );
    });

    it('consumeState finds and deletes state atomically to prevent replay attacks', async () => {
      vi.spyOn(OAuthStateModel, 'findOneAndDelete').mockResolvedValueOnce({
        _id: '1',
        state: 'valid_state_123',
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      const isValid = await OAuthStateRepository.consumeState('valid_state_123');
      expect(isValid).toBe(true);
    });

    it('consumeState returns false for non-existent or expired state', async () => {
      vi.spyOn(OAuthStateModel, 'findOneAndDelete').mockResolvedValueOnce(null);

      const isValid = await OAuthStateRepository.consumeState('expired_or_invalid_state');
      expect(isValid).toBe(false);
    });
  });
});

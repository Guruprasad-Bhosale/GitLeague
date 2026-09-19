import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionRepository, UserRepository, QuestProgressRepository } from '@gitleague/database';

describe('Quests API Endpoints (/api/v1/me/quests)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockSession = {
    _id: 'session_123',
    userId: '507f1f77bcf86cd799439011',
    sessionHash: 'hash_123',
    expiresAt: new Date(Date.now() + 86400000),
  };

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: '12345',
    username: 'questrunner',
    avatarUrl: 'https://avatar.url',
    githubProfileUrl: 'https://github.com/questrunner',
    syncStatus: 'completed',
    lastSyncedAt: new Date('2026-09-17T10:00:00Z'),
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  describe('GET /api/v1/me/quests', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app).get('/api/v1/me/quests');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns daily and weekly quests with active progress for authenticated user', async () => {
      vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(SessionRepository, 'touchSession').mockResolvedValueOnce();
      vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUser as any);
      vi.spyOn(UserRepository, 'toSafeUser').mockReturnValueOnce({
        id: '507f1f77bcf86cd799439011',
        githubId: '12345',
        username: 'questrunner',
        avatarUrl: 'https://avatar.url',
        githubProfileUrl: 'https://github.com/questrunner',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      vi.spyOn(QuestProgressRepository, 'getUserQuestProgress')
        .mockResolvedValueOnce([
          {
            userId: '507f1f77bcf86cd799439011',
            questId: 'daily_commits_3',
            questType: 'daily',
            periodKey: 'daily:2026-09-17',
            progress: 3,
            target: 3,
            completed: true,
            rewardXP: 100,
            rewardGranted: true,
            completedAt: new Date(),
          } as any,
        ])
        .mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/me/quests')
        .set('Cookie', ['gitleague_session=valid_raw_session_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.daily).toBeInstanceOf(Array);
      expect(res.body.data.weekly).toBeInstanceOf(Array);
      expect(res.body.data.daily.length).toBeGreaterThan(0);
      expect(res.body.data.weekly.length).toBeGreaterThan(0);
      expect(res.body.data.lastSyncedAt).toBe('2026-09-17T10:00:00.000Z');
    });
  });
});

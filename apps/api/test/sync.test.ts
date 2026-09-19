import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionRepository, UserRepository } from '@gitleague/database';
import { QueueService } from '../src/services/queue.service.js';

describe('Sync API Endpoints (/api/v1/me/sync)', () => {
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
    username: 'testdev',
    avatarUrl: 'https://avatar.url',
    githubProfileUrl: 'https://github.com/testdev',
    syncStatus: 'completed',
    lastSyncedAt: new Date('2026-09-17T10:00:00Z'),
    syncStartedAt: new Date('2026-09-17T09:59:50Z'),
    syncCompletedAt: new Date('2026-09-17T10:00:00Z'),
    syncError: null,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  describe('GET /api/v1/me/sync', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app).get('/api/v1/me/sync');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns sync status for authenticated user', async () => {
      vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(SessionRepository, 'touchSession').mockResolvedValueOnce();
      vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUser as any);
      vi.spyOn(UserRepository, 'toSafeUser').mockReturnValueOnce({
        id: '507f1f77bcf86cd799439011',
        githubId: '12345',
        username: 'testdev',
        avatarUrl: 'https://avatar.url',
        githubProfileUrl: 'https://github.com/testdev',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/me/sync')
        .set('Cookie', ['gitleague_session=valid_raw_session_token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.syncStatus).toBe('completed');
      expect(res.body.data.userId).toBe('507f1f77bcf86cd799439011');
    });
  });

  describe('POST /api/v1/me/sync', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app).post('/api/v1/me/sync');
      expect(res.status).toBe(401);
    });

    it('queues a background sync job and returns 202 Accepted', async () => {
      vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(SessionRepository, 'touchSession').mockResolvedValueOnce();
      vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUser as any);
      vi.spyOn(UserRepository, 'toSafeUser').mockReturnValueOnce({
        id: '507f1f77bcf86cd799439011',
        githubId: '12345',
        username: 'testdev',
        avatarUrl: 'https://avatar.url',
        githubProfileUrl: 'https://github.com/testdev',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      vi.spyOn(QueueService, 'enqueueUserSync').mockResolvedValueOnce({
        jobId: 'job_456',
        status: 'queued',
        queued: true,
      });

      const res = await request(app)
        .post('/api/v1/me/sync')
        .set('Cookie', ['gitleague_session=valid_raw_session_token'])
        .send({ force: true });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.syncStatus).toBe('queued');
      expect(res.body.data.jobId).toBe('job_456');
    });
  });
});

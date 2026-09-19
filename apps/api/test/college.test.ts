import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  CollegeRepository,
  UserRepository,
  SessionRepository,
  UserModel,
} from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('College Directory & Affiliation API Endpoints', () => {
  const app = createApp();

  const user = {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    githubId: '1001',
    username: 'collegedev',
    collegeId: null,
    save: vi.fn().mockResolvedValue(true),
  };

  const mockCollege = {
    _id: '607f1f77bcf86cd799439099',
    id: '607f1f77bcf86cd799439099',
    name: 'Indian Institute of Technology Bombay',
    shortName: 'IIT Bombay',
    slug: 'iit-bombay',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    verified: true,
  };

  const mockSession = {
    _id: 'session_123',
    userId: user.id,
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
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(user as any);
    vi.spyOn(UserRepository, 'toSafeUser').mockReturnValue({
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      displayName: 'College Dev',
      avatarUrl: 'https://avatar.url',
      githubProfileUrl: 'https://github.com/collegedev',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
  });

  describe('GET /api/v1/colleges', () => {
    it('returns list of verified colleges from directory', async () => {
      vi.spyOn(CollegeRepository, 'searchColleges').mockResolvedValueOnce([mockCollege as any]);

      const res = await request(app).get('/api/v1/colleges?search=Bombay');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe('iit-bombay');
      expect(res.body.data[0].verified).toBe(true);
    });
  });

  describe('PATCH /api/v1/me/college', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app)
        .patch('/api/v1/me/college')
        .send({ collegeId: mockCollege.id });

      expect(res.status).toBe(401);
    });

    it('successfully updates user college affiliation with verified directory ID', async () => {
      vi.spyOn(CollegeRepository, 'findById').mockResolvedValueOnce(mockCollege as any);
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(user as any);

      const res = await request(app)
        .patch('/api/v1/me/college')
        .set('Cookie', ['gitleague_session=valid_token'])
        .send({ collegeId: mockCollege.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.college.name).toBe('Indian Institute of Technology Bombay');
    });

    it('rejects invalid or non-existent college IDs (404)', async () => {
      vi.spyOn(CollegeRepository, 'findById').mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/v1/me/college')
        .set('Cookie', ['gitleague_session=valid_token'])
        .send({ collegeId: '999999999999999999999999' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('allows clearing college affiliation by passing null', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValueOnce(user as any);

      const res = await request(app)
        .patch('/api/v1/me/college')
        .set('Cookie', ['gitleague_session=valid_token'])
        .send({ collegeId: null });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.collegeId).toBeNull();
    });
  });
});

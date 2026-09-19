import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  UserModel,
  GameProfileModel,
  FriendshipRepository,
} from '@gitleague/database';
import { CacheService } from '../src/lib/redis.js';

describe('User Search API (GET /api/v1/users/search)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue();
  });

  it('searches participants and returns public profile cards', async () => {
    const mockUsers = [
      {
        _id: '507f1f77bcf86cd799439011',
        username: 'alice',
        displayName: 'Alice Developer',
        avatarUrl: 'https://avatar.url/alice',
        collegeId: null,
      },
    ];

    const mockProfiles = [
      {
        userId: '507f1f77bcf86cd799439011',
        level: 25,
        tier: 'PLATINUM',
        xp: 6500,
      },
    ];

    vi.spyOn(UserModel, 'find').mockReturnValue({
      limit: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockUsers),
      }),
    } as any);

    vi.spyOn(GameProfileModel, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockProfiles),
    } as any);

    vi.spyOn(FriendshipRepository, 'getFriendshipStatus').mockResolvedValueOnce({
      status: 'none',
    });

    const res = await request(app).get('/api/v1/users/search?q=alice');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].username).toBe('alice');
    expect(res.body.data[0].level).toBe(25);
    expect(res.body.data[0].tier).toBe('PLATINUM');
  });

  it('validates query parameter and rejects empty query', async () => {
    const res = await request(app).get('/api/v1/users/search?q=');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

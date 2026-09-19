import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GitHubService, GitHubNotFoundError, GitHubRateLimitError } from '@gitleague/github';

describe('GitHub Integration API Endpoints', () => {
  const app = createApp();

  it('GET /api/v1/github/users/:username returns normalized user profile', async () => {
    const mockUser = {
      id: 583231,
      login: 'octocat',
      name: 'The Octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
      htmlUrl: 'https://github.com/octocat',
      bio: 'GitHub mascot',
      location: 'San Francisco',
      company: '@github',
      blog: 'https://github.blog',
      twitterUsername: 'monatheoctocat',
      publicRepositories: 8,
      publicGists: 8,
      followers: 10000,
      following: 9,
      createdAt: '2011-01-25T18:44:36Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    vi.spyOn(GitHubService.prototype, 'getUser').mockResolvedValueOnce(mockUser);

    const res = await request(app).get('/api/v1/github/users/octocat');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.login).toBe('octocat');
    expect(res.body.data.id).toBe(583231);
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/github/users/:username returns 404 for non-existent user', async () => {
    vi.spyOn(GitHubService.prototype, 'getUser').mockRejectedValueOnce(
      new GitHubNotFoundError('GitHub resource not found: Not Found')
    );

    const res = await request(app).get('/api/v1/github/users/nonexistent-user-xyz');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
  });

  it('GET /api/v1/github/users/:username returns 429 when rate limited', async () => {
    vi.spyOn(GitHubService.prototype, 'getUser').mockRejectedValueOnce(
      new GitHubRateLimitError('GitHub API rate limit exceeded')
    );

    const res = await request(app).get('/api/v1/github/users/octocat');

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('GET /api/v1/github/users/:username returns 400 for invalid username format', async () => {
    const res = await request(app).get('/api/v1/github/users/invalid--username--triple---');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

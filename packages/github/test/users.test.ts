import { describe, it, expect, vi } from 'vitest';
import { GitHubService } from '../src/service.js';
import { Octokit } from '@octokit/rest';
import { GitHubNotFoundError, GitHubRateLimitError } from '../src/errors.js';

describe('GitHubService — User Lookup', () => {
  it('successfully fetches and normalizes public user profile', async () => {
    const mockUserResponse = {
      data: {
        id: 583231,
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
        html_url: 'https://github.com/octocat',
        bio: 'Mascot of GitHub',
        location: 'San Francisco',
        company: '@github',
        blog: 'https://github.blog',
        twitter_username: 'monatheoctocat',
        public_repos: 8,
        public_gists: 8,
        followers: 10000,
        following: 9,
        created_at: '2011-01-25T18:44:36Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      headers: {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': '1700000000',
      },
    };

    const mockOctokit = {
      rest: {
        users: {
          getByUsername: vi.fn().mockResolvedValue(mockUserResponse),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    const user = await service.getUser('octocat');

    expect(user.id).toBe(583231);
    expect(user.login).toBe('octocat');
    expect(user.name).toBe('The Octocat');
    expect(user.avatarUrl).toBe('https://avatars.githubusercontent.com/u/583231?v=4');
    expect(user.publicRepositories).toBe(8);
    expect(user.followers).toBe(10000);

    const rateLimit = service.getRateLimitInfo();
    expect(rateLimit).toBeDefined();
    expect(rateLimit?.limit).toBe(5000);
    expect(rateLimit?.remaining).toBe(4999);
  });

  it('throws GitHubNotFoundError when username does not exist (404)', async () => {
    const mockOctokit = {
      rest: {
        users: {
          getByUsername: vi.fn().mockRejectedValue({
            status: 404,
            response: {
              status: 404,
              data: { message: 'Not Found' },
              headers: {
                'x-ratelimit-limit': '60',
                'x-ratelimit-remaining': '59',
                'x-ratelimit-reset': '1700000000',
              },
            },
          }),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    await expect(service.getUser('nonexistent-user-12345')).rejects.toThrow(GitHubNotFoundError);
  });

  it('throws GitHubRateLimitError when rate limit is exceeded', async () => {
    const mockOctokit = {
      rest: {
        users: {
          getByUsername: vi.fn().mockRejectedValue({
            status: 403,
            response: {
              status: 403,
              data: { message: 'API rate limit exceeded for 127.0.0.1' },
              headers: {
                'x-ratelimit-limit': '60',
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': '1700000000',
              },
            },
          }),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    await expect(service.getUser('octocat')).rejects.toThrow(GitHubRateLimitError);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { GitHubService } from '../src/service.js';
import { Octokit } from '@octokit/rest';

describe('GitHubService — Repository Fetching & Pagination', () => {
  it('normalizes repository data and respects page boundaries', async () => {
    const mockReposPage = [
      {
        id: 1296269,
        name: 'Hello-World',
        full_name: 'octocat/Hello-World',
        private: false,
        fork: false,
        archived: false,
        html_url: 'https://github.com/octocat/Hello-World',
        description: 'My first repo',
        language: 'TypeScript',
        stargazers_count: 2400,
        forks_count: 1800,
        open_issues_count: 50,
        watchers_count: 2400,
        default_branch: 'master',
        created_at: '2011-01-26T19:01:12Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-01T00:00:00Z',
        size: 108,
      },
    ];

    const mockOctokit = {
      rest: {
        repos: {
          listForUser: vi.fn().mockResolvedValue({
            data: mockReposPage,
            headers: {
              'x-ratelimit-limit': '5000',
              'x-ratelimit-remaining': '4990',
              'x-ratelimit-reset': '1700000000',
            },
          }),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    const repos = await service.getUserRepositories('octocat', { maxPages: 1, perPage: 10 });

    expect(repos).toHaveLength(1);
    expect(repos[0].id).toBe(1296269);
    expect(repos[0].fullName).toBe('octocat/Hello-World');
    expect(repos[0].stars).toBe(2400);
    expect(repos[0].forks).toBe(1800);
    expect(repos[0].language).toBe('TypeScript');
  });

  it('stops pagination when empty page is encountered', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          listForUser: vi.fn().mockResolvedValue({
            data: [],
            headers: {},
          }),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    const repos = await service.getUserRepositories('octocat', { maxPages: 3 });

    expect(repos).toHaveLength(0);
    expect(mockOctokit.rest.repos.listForUser).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { GitHubService } from '../src/service.js';
import { Octokit } from '@octokit/rest';

describe('GitHub Pagination Limits & Controls', () => {
  it('respects maxItems configuration and caps results appropriately', async () => {
    const generatePage = (startId: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: startId + i,
        name: `repo-${startId + i}`,
        full_name: `octocat/repo-${startId + i}`,
        private: false,
        fork: false,
        archived: false,
        html_url: `https://github.com/octocat/repo-${startId + i}`,
        description: null,
        language: 'TypeScript',
        stargazers_count: 10,
        forks_count: 5,
        open_issues_count: 1,
        watchers_count: 10,
        default_branch: 'main',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: null,
        size: 50,
      }));

    const mockOctokit = {
      rest: {
        repos: {
          listForUser: vi
            .fn()
            .mockResolvedValueOnce({ data: generatePage(1, 10), headers: {} })
            .mockResolvedValueOnce({ data: generatePage(11, 10), headers: {} }),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    const repos = await service.getUserRepositories('octocat', { perPage: 10, maxPages: 2, maxItems: 15 });

    expect(repos).toHaveLength(15);
    expect(repos[0].name).toBe('repo-1');
    expect(repos[14].name).toBe('repo-15');
  });
});

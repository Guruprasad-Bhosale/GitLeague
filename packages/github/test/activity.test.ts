import { describe, it, expect, vi } from 'vitest';
import { GitHubService } from '../src/service.js';
import { Octokit } from '@octokit/rest';

describe('GitHubService — Activity & Events', () => {
  it('normalizes public events properly into domain activity types', async () => {
    const mockEvents = [
      {
        id: '12345678',
        type: 'PushEvent',
        actor: { login: 'octocat' },
        repo: { name: 'octocat/Hello-World' },
        created_at: '2026-09-16T12:00:00Z',
        payload: {
          commits: [{ sha: 'abc1234' }, { sha: 'def5678' }],
          ref: 'refs/heads/main',
        },
      },
      {
        id: '12345679',
        type: 'PullRequestEvent',
        actor: { login: 'octocat' },
        repo: { name: 'octocat/Hello-World' },
        created_at: '2026-09-16T13:00:00Z',
        payload: {
          action: 'opened',
          pull_request: { number: 42, merged: false },
        },
      },
    ];

    const mockOctokit = {
      rest: {
        activity: {
          listPublicEventsForUser: vi.fn().mockResolvedValue({
            data: mockEvents,
            headers: {},
          }),
        },
      },
    } as unknown as Octokit;

    const service = new GitHubService(mockOctokit);
    const activity = await service.getUserActivity('octocat');

    expect(activity).toHaveLength(2);
    expect(activity[0].type).toBe('PushEvent');
    expect(activity[0].payload.commitsCount).toBe(2);
    expect(activity[1].type).toBe('PullRequestEvent');
    expect(activity[1].payload.pullRequestNumber).toBe(42);
    expect(activity[1].payload.isMerged).toBe(false);
  });
});

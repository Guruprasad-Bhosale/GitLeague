import { NormalizedGitHubActivityItem, GitHubActivityType } from '../types.js';

export function normalizeGitHubActivityItem(event: {
  id: string;
  type: string | null;
  actor: { login: string };
  repo: { name: string };
  created_at: string | null;
  payload?: {
    action?: string;
    commits?: unknown[];
    size?: number;
    ref?: string;
    ref_type?: string;
    issue?: { number?: number };
    pull_request?: { number?: number; merged?: boolean };
  };
}): NormalizedGitHubActivityItem {
  const allowedTypes: GitHubActivityType[] = [
    'PushEvent',
    'PullRequestEvent',
    'IssuesEvent',
    'IssueCommentEvent',
    'CreateEvent',
    'DeleteEvent',
    'WatchEvent',
    'ForkEvent',
    'PublicEvent',
  ];

  const type: GitHubActivityType = allowedTypes.includes(event.type as GitHubActivityType)
    ? (event.type as GitHubActivityType)
    : 'UnknownEvent';

  return {
    id: event.id,
    type,
    actor: event.actor?.login ?? 'unknown',
    repo: event.repo?.name ?? 'unknown',
    createdAt: event.created_at ?? new Date().toISOString(),
    payload: {
      action: event.payload?.action,
      commitsCount: event.payload?.commits?.length ?? event.payload?.size,
      ref: event.payload?.ref,
      refType: event.payload?.ref_type,
      issueNumber: event.payload?.issue?.number,
      pullRequestNumber: event.payload?.pull_request?.number,
      isMerged: event.payload?.pull_request?.merged,
    },
  };
}

export function normalizeGitHubActivities(events: Array<Parameters<typeof normalizeGitHubActivityItem>[0]>): NormalizedGitHubActivityItem[] {
  return events.map(normalizeGitHubActivityItem);
}

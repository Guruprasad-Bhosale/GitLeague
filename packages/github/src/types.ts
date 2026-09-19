// ==========================================
// Normalized Domain Types for GitHub Integration
// ==========================================

export interface NormalizedGitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  twitterUsername: string | null;
  publicRepositories: number;
  publicGists: number;
  followers: number;
  following: number;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedGitHubRepository {
  id: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  sizeKb: number;
}

export type GitHubActivityType =
  | 'PushEvent'
  | 'PullRequestEvent'
  | 'IssuesEvent'
  | 'IssueCommentEvent'
  | 'CreateEvent'
  | 'DeleteEvent'
  | 'WatchEvent'
  | 'ForkEvent'
  | 'PublicEvent'
  | 'UnknownEvent';

export interface NormalizedGitHubActivityItem {
  id: string;
  type: GitHubActivityType;
  actor: string;
  repo: string;
  createdAt: string;
  payload: {
    action?: string;
    commitsCount?: number;
    ref?: string;
    refType?: string;
    issueNumber?: number;
    pullRequestNumber?: number;
    isMerged?: boolean;
  };
}

export interface NormalizedGitHubLanguageStats {
  [language: string]: number; // Bytes of code
}

export interface GitHubPaginationOptions {
  page?: number;
  perPage?: number;
  maxPages?: number;
  maxItems?: number;
}

export interface NormalizedUserAggregatedData {
  user: NormalizedGitHubUser;
  repositories: NormalizedGitHubRepository[];
  stats: {
    totalStars: number;
    totalForks: number;
    totalOpenIssues: number;
    publicRepos: number;
    languages: NormalizedGitHubLanguageStats;
  };
  recentActivity: NormalizedGitHubActivityItem[];
}

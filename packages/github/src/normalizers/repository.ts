import { NormalizedGitHubRepository } from '../types.js';

export function normalizeGitHubRepository(repo: {
  id: number;
  name: string;
  full_name: string;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  html_url: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  watchers_count?: number;
  default_branch?: string;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  size?: number;
}): NormalizedGitHubRepository {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    isPrivate: repo.private ?? false,
    isFork: repo.fork ?? false,
    isArchived: repo.archived ?? false,
    htmlUrl: repo.html_url,
    description: repo.description ?? null,
    language: repo.language ?? null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    watchers: repo.watchers_count ?? 0,
    defaultBranch: repo.default_branch ?? 'main',
    createdAt: repo.created_at ?? new Date(0).toISOString(),
    updatedAt: repo.updated_at ?? new Date(0).toISOString(),
    pushedAt: repo.pushed_at ?? null,
    sizeKb: repo.size ?? 0,
  };
}

export function normalizeGitHubRepositories(repos: Array<Parameters<typeof normalizeGitHubRepository>[0]>): NormalizedGitHubRepository[] {
  return repos.map(normalizeGitHubRepository);
}

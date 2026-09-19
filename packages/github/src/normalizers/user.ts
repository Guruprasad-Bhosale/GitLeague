import { NormalizedGitHubUser } from '../types.js';

export function normalizeGitHubUser(data: {
  id: number;
  login: string;
  name?: string | null;
  avatar_url: string;
  html_url: string;
  bio?: string | null;
  location?: string | null;
  company?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  following?: number;
  created_at: string;
  updated_at: string;
}): NormalizedGitHubUser {
  return {
    id: data.id,
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
    bio: data.bio ?? null,
    location: data.location ?? null,
    company: data.company ?? null,
    blog: data.blog ?? null,
    twitterUsername: data.twitter_username ?? null,
    publicRepositories: data.public_repos ?? 0,
    publicGists: data.public_gists ?? 0,
    followers: data.followers ?? 0,
    following: data.following ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

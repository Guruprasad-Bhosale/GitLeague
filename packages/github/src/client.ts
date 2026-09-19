import { Octokit } from '@octokit/rest';

export interface IGitHubClientOptions {
  auth?: string;
  userAgent?: string;
  baseUrl?: string;
  request?: {
    timeout?: number;
  };
}

export function createGitHubClient(options?: IGitHubClientOptions): Octokit {
  return new Octokit({
    auth: options?.auth,
    userAgent: options?.userAgent ?? 'GitLeague-Platform/1.0.0',
    baseUrl: options?.baseUrl,
    request: {
      timeout: options?.request?.timeout ?? 10000,
    },
  });
}

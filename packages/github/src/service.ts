import { Octokit } from '@octokit/rest';
import { createGitHubClient, IGitHubClientOptions } from './client.js';
import {
  NormalizedGitHubUser,
  NormalizedGitHubRepository,
  NormalizedGitHubActivityItem,
  NormalizedGitHubLanguageStats,
  GitHubPaginationOptions,
  NormalizedUserAggregatedData,
} from './types.js';
import { normalizeGitHubUser } from './normalizers/user.js';
import { normalizeGitHubRepositories } from './normalizers/repository.js';
import { normalizeGitHubActivities } from './normalizers/activity.js';
import { mapOctokitError, GitHubError, GitHubRateLimitError, GitHubNotFoundError } from './errors.js';
import { parseRateLimitHeaders, RateLimitInfo } from './rate-limit.js';

export class GitHubService {
  private octokit: Octokit;
  private lastRateLimitInfo: RateLimitInfo | null = null;

  constructor(options?: IGitHubClientOptions | Octokit | { rest: unknown }) {
    if (options && 'rest' in options) {
      this.octokit = options as Octokit;
    } else {
      this.octokit = createGitHubClient(options as IGitHubClientOptions);
    }
  }

  /**
   * Returns latest known rate limit information.
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.lastRateLimitInfo;
  }

  /**
   * Internal execution wrapper that captures rate-limit headers and executes conservative retry for transient 5xx/network failures.
   */
  private async executeWithRetry<T>(
    operationName: string,
    operation: () => Promise<{ data: T; headers: Record<string, string | number | undefined> }>,
    maxRetries = 1
  ): Promise<T> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await operation();
        if (response.headers) {
          const parsedRateLimit = parseRateLimitHeaders(response.headers);
          if (parsedRateLimit) {
            this.lastRateLimitInfo = parsedRateLimit;
          }
        }
        return response.data;
      } catch (err: unknown) {
        const mappedError = mapOctokitError(err, operationName);

        // Do not retry client errors or rate limit exhaustion
        if (
          mappedError instanceof GitHubNotFoundError ||
          mappedError instanceof GitHubRateLimitError ||
          mappedError.status === 400 ||
          mappedError.status === 401 ||
          mappedError.status === 403 ||
          mappedError.status === 404 ||
          mappedError.status === 422
        ) {
          throw mappedError;
        }

        if (attempt >= maxRetries) {
          throw mappedError;
        }

        // Exponential backoff: 300ms, 600ms...
        attempt++;
        const backoffMs = attempt * 300;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new GitHubError(`Operation ${operationName} failed after ${maxRetries} retries`);
  }

  /**
   * Fetches public GitHub user profile.
   */
  async getUser(username: string): Promise<NormalizedGitHubUser> {
    const data = await this.executeWithRetry(`users.getByUsername(${username})`, () =>
      this.octokit.rest.users.getByUsername({ username })
    );
    return normalizeGitHubUser(data);
  }

  /**
   * Fetches public repositories belonging to a user with pagination controls.
   */
  async getUserRepositories(
    username: string,
    options?: GitHubPaginationOptions
  ): Promise<NormalizedGitHubRepository[]> {
    const perPage = Math.min(options?.perPage ?? 100, 100);
    const maxPages = options?.maxPages ?? 3;
    const maxItems = options?.maxItems ?? 300;

    let currentPage = options?.page ?? 1;
    let allRepos: NormalizedGitHubRepository[] = [];

    while (currentPage <= (options?.page ? options.page : maxPages)) {
      const pageData = await this.executeWithRetry(`repos.listForUser(${username}, page=${currentPage})`, () =>
        this.octokit.rest.repos.listForUser({
          username,
          sort: 'updated',
          per_page: perPage,
          page: currentPage,
          type: 'owner',
        })
      );

      if (!pageData || pageData.length === 0) {
        break;
      }

      const normalized = normalizeGitHubRepositories(pageData);
      allRepos = allRepos.concat(normalized);

      if (allRepos.length >= maxItems || pageData.length < perPage || options?.page) {
        break;
      }

      currentPage++;
    }

    return allRepos.slice(0, maxItems);
  }

  /**
   * Fetches public activity events for a user with pagination limits.
   */
  async getUserActivity(
    username: string,
    options?: GitHubPaginationOptions
  ): Promise<NormalizedGitHubActivityItem[]> {
    const perPage = Math.min(options?.perPage ?? 100, 100);
    const maxPages = options?.maxPages ?? 2;
    const maxItems = options?.maxItems ?? 200;

    let currentPage = options?.page ?? 1;
    let allEvents: NormalizedGitHubActivityItem[] = [];

    while (currentPage <= (options?.page ? options.page : maxPages)) {
      const pageData = await this.executeWithRetry(`activity.listPublicEventsForUser(${username}, page=${currentPage})`, () =>
        this.octokit.rest.activity.listPublicEventsForUser({
          username,
          per_page: perPage,
          page: currentPage,
        })
      );

      if (!pageData || pageData.length === 0) {
        break;
      }

      const normalized = normalizeGitHubActivities(pageData as Array<Parameters<typeof normalizeGitHubActivities>[0][0]>);
      allEvents = allEvents.concat(normalized);

      if (allEvents.length >= maxItems || pageData.length < perPage || options?.page) {
        break;
      }

      currentPage++;
    }

    return allEvents.slice(0, maxItems);
  }

  /**
   * Fetches language breakdown (bytes of code) for a specific repository.
   */
  async getRepositoryLanguages(owner: string, repo: string): Promise<NormalizedGitHubLanguageStats> {
    const data = await this.executeWithRetry(`repos.listLanguages(${owner}/${repo})`, () =>
      this.octokit.rest.repos.listLanguages({ owner, repo })
    );
    return data as NormalizedGitHubLanguageStats;
  }

  /**
   * Aggregates public user profile, authored repositories, language totals, and public activity into a structured domain payload.
   */
  async getUserAggregatedData(username: string): Promise<NormalizedUserAggregatedData> {
    const [user, repositories, recentActivity] = await Promise.all([
      this.getUser(username),
      this.getUserRepositories(username, { maxPages: 2, perPage: 100 }),
      this.getUserActivity(username, { maxPages: 1, perPage: 50 }),
    ]);

    let totalStars = 0;
    let totalForks = 0;
    let totalOpenIssues = 0;
    const languageTotals: NormalizedGitHubLanguageStats = {};

    for (const repo of repositories) {
      totalStars += repo.stars;
      totalForks += repo.forks;
      totalOpenIssues += repo.openIssues;
      if (repo.language) {
        languageTotals[repo.language] = (languageTotals[repo.language] || 0) + 1;
      }
    }

    return {
      user,
      repositories,
      stats: {
        totalStars,
        totalForks,
        totalOpenIssues,
        publicRepos: user.publicRepositories,
        languages: languageTotals,
      },
      recentActivity,
    };
  }
}

import { describe, it, expect } from 'vitest';
import {
  mapOctokitError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubAuthenticationError,
  GitHubForbiddenError,
  GitHubNetworkError,
  GitHubAPIError,
} from '../src/errors.js';

describe('GitHub Error Mapping', () => {
  it('maps 404 response to GitHubNotFoundError', () => {
    const err = mapOctokitError({ status: 404, message: 'Not Found' }, 'users.get');
    expect(err).toBeInstanceOf(GitHubNotFoundError);
    expect(err.status).toBe(404);
    expect(err.endpoint).toBe('users.get');
  });

  it('maps 401 response to GitHubAuthenticationError', () => {
    const err = mapOctokitError({ status: 401, message: 'Bad credentials' });
    expect(err).toBeInstanceOf(GitHubAuthenticationError);
    expect(err.status).toBe(401);
  });

  it('maps 403 rate limit to GitHubRateLimitError', () => {
    const err = mapOctokitError({
      status: 403,
      response: {
        status: 403,
        data: { message: 'API rate limit exceeded' },
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
      },
    });
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.rateLimitRemaining).toBe(0);
    expect(err.rateLimitReset).toBeDefined();
  });

  it('maps 403 forbidden to GitHubForbiddenError', () => {
    const err = mapOctokitError({ status: 403, message: 'Resource is blocked' });
    expect(err).toBeInstanceOf(GitHubForbiddenError);
  });

  it('maps network errors to GitHubNetworkError', () => {
    const err = mapOctokitError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND api.github.com' });
    expect(err).toBeInstanceOf(GitHubNetworkError);
  });

  it('maps generic errors to GitHubAPIError', () => {
    const err = mapOctokitError({ status: 500, message: 'Internal GitHub error' });
    expect(err).toBeInstanceOf(GitHubAPIError);
  });
});

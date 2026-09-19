// ==========================================
// GitLeague GitHub Integration Error Classes
// ==========================================

export interface GitHubErrorDetails {
  status?: number;
  endpoint?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
  requestId?: string;
  cause?: unknown;
}

export class GitHubError extends Error {
  public readonly status?: number;
  public readonly endpoint?: string;
  public readonly rateLimitRemaining?: number;
  public readonly rateLimitReset?: Date;
  public readonly requestId?: string;

  constructor(message: string, details?: GitHubErrorDetails) {
    super(message);
    this.name = 'GitHubError';
    this.status = details?.status;
    this.endpoint = details?.endpoint;
    this.rateLimitRemaining = details?.rateLimitRemaining;
    this.rateLimitReset = details?.rateLimitReset;
    this.requestId = details?.requestId;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(message = 'GitHub resource not found', details?: GitHubErrorDetails) {
    super(message, { ...details, status: 404 });
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(message = 'GitHub API rate limit exceeded', details?: GitHubErrorDetails) {
    super(message, { ...details, status: details?.status ?? 403 });
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubAuthenticationError extends GitHubError {
  constructor(message = 'GitHub API authentication failed or token invalid', details?: GitHubErrorDetails) {
    super(message, { ...details, status: 401 });
    this.name = 'GitHubAuthenticationError';
  }
}

export class GitHubForbiddenError extends GitHubError {
  constructor(message = 'GitHub API access forbidden', details?: GitHubErrorDetails) {
    super(message, { ...details, status: 403 });
    this.name = 'GitHubForbiddenError';
  }
}

export class GitHubNetworkError extends GitHubError {
  constructor(message = 'Failed to connect to GitHub API', details?: GitHubErrorDetails) {
    super(message, details);
    this.name = 'GitHubNetworkError';
  }
}

export class GitHubAPIError extends GitHubError {
  constructor(message = 'GitHub API returned an error', details?: GitHubErrorDetails) {
    super(message, details);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Maps raw Octokit/Fetch errors into typed GitHubError hierarchy
 */
export function mapOctokitError(err: unknown, endpoint?: string): GitHubError {
  if (err instanceof GitHubError) {
    return err;
  }

  const raw = err as {
    status?: number;
    message?: string;
    response?: {
      status?: number;
      headers?: Record<string, string | number>;
      data?: { message?: string };
    };
    code?: string;
  };

  const status = raw.status || raw.response?.status;
  const message = raw.response?.data?.message || raw.message || 'Unknown GitHub API error';

  const remaining = raw.response?.headers?.['x-ratelimit-remaining'];
  const reset = raw.response?.headers?.['x-ratelimit-reset'];
  const rateLimitRemaining = remaining !== undefined ? Number(remaining) : undefined;
  const rateLimitReset = reset !== undefined ? new Date(Number(reset) * 1000) : undefined;
  const requestId = raw.response?.headers?.['x-github-request-id'] ? String(raw.response.headers['x-github-request-id']) : undefined;

  const details: GitHubErrorDetails = {
    status,
    endpoint,
    rateLimitRemaining,
    rateLimitReset,
    requestId,
    cause: err,
  };

  if (status === 404) {
    return new GitHubNotFoundError(`GitHub resource not found at ${endpoint ?? 'endpoint'}: ${message}`, details);
  }

  if (status === 401) {
    return new GitHubAuthenticationError(`GitHub authentication failed: ${message}`, details);
  }

  if (status === 403 || status === 429) {
    if (
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('secondary rate limit') ||
      rateLimitRemaining === 0
    ) {
      return new GitHubRateLimitError(`GitHub rate limit reached: ${message}`, details);
    }
    return new GitHubForbiddenError(`GitHub access forbidden: ${message}`, details);
  }

  if (raw.code === 'ENOTFOUND' || raw.code === 'ETIMEDOUT' || raw.code === 'ECONNRESET' || raw.code === 'ECONNREFUSED') {
    return new GitHubNetworkError(`GitHub network failure (${raw.code}): ${message}`, details);
  }

  return new GitHubAPIError(`GitHub API error (${status ?? 'unknown'}): ${message}`, details);
}

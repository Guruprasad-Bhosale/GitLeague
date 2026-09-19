// ==========================================
// Rate Limit Tracking and Inspection
// ==========================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  used: number;
  resource?: string;
}

export function parseRateLimitHeaders(headers: Record<string, string | number | undefined>): RateLimitInfo | null {
  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = headers['x-ratelimit-reset'];
  const used = headers['x-ratelimit-used'];
  const resource = headers['x-ratelimit-resource'];

  if (limit === undefined || remaining === undefined || reset === undefined) {
    return null;
  }

  const limitNum = Number(limit);
  const remainingNum = Number(remaining);
  const resetSec = Number(reset);
  const usedNum = used !== undefined ? Number(used) : limitNum - remainingNum;

  return {
    limit: limitNum,
    remaining: remainingNum,
    resetAt: new Date(resetSec * 1000),
    used: usedNum,
    resource: typeof resource === 'string' ? resource : undefined,
  };
}

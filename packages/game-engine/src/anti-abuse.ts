// ==========================================
// Anti-Abuse & Input Sanitization Primitives
// ==========================================

export interface RawStatsInput {
  commits?: number | null;
  pullRequests?: number | null;
  mergedPullRequests?: number | null;
  issues?: number | null;
  repositories?: number | null;
  stars?: number | null;
  contributionDays?: number | null;
  currentStreak?: number | null;
  longestStreak?: number | null;
}

export interface SanitizedStats {
  commits: number;
  pullRequests: number;
  mergedPullRequests: number;
  issues: number;
  repositories: number;
  stars: number;
  contributionDays: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Clamps any arbitrary number to a non-negative integer, protecting against NaN, Infinity, and negative exploits.
 */
export function clampNonNegative(val: unknown, maxCap = Number.MAX_SAFE_INTEGER): number {
  if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val) || val <= 0) {
    return 0;
  }
  return Math.min(Math.floor(val), maxCap);
}

/**
 * Sanitizes all input statistics into valid non-negative integers.
 */
export function sanitizeStats(raw: RawStatsInput): SanitizedStats {
  const commits = clampNonNegative(raw.commits);
  const pullRequests = clampNonNegative(raw.pullRequests);
  // Merged PRs cannot exceed total PRs
  const mergedPullRequests = Math.min(clampNonNegative(raw.mergedPullRequests), pullRequests);
  const issues = clampNonNegative(raw.issues);
  const repositories = clampNonNegative(raw.repositories);
  const stars = clampNonNegative(raw.stars);
  const contributionDays = clampNonNegative(raw.contributionDays, 3650); // capped at 10 years
  const currentStreak = clampNonNegative(raw.currentStreak, 3650);
  const longestStreak = Math.max(currentStreak, clampNonNegative(raw.longestStreak, 3650));

  return {
    commits,
    pullRequests,
    mergedPullRequests,
    issues,
    repositories,
    stars,
    contributionDays,
    currentStreak,
    longestStreak,
  };
}

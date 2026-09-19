import { SCORING_RULES } from '@gitleague/config';
import { IXpBreakdown } from '@gitleague/types';
import { RawStatsInput, sanitizeStats } from './anti-abuse.js';

export type ScoringConfig = typeof SCORING_RULES;

/**
 * Calculates raw base XP from GitHub statistics using configurable scoring rules.
 */
export function calculateXP(statsInput: RawStatsInput, config: ScoringConfig = SCORING_RULES): number {
  const breakdown = calculateXPBreakdown(statsInput, config);
  return breakdown.totalXP;
}

/**
 * Produces an explainable, transparent XP breakdown itemizing each activity's contribution.
 */
export function calculateXPBreakdown(
  statsInput: RawStatsInput,
  config: ScoringConfig = SCORING_RULES
): IXpBreakdown {
  const stats = sanitizeStats(statsInput);

  const commitsXP = stats.commits * config.COMMIT_XP;
  const pullRequestsXP = stats.pullRequests * config.PULL_REQUEST_XP;
  const mergedPullRequestsXP = stats.mergedPullRequests * config.MERGED_PULL_REQUEST_XP;
  const issuesXP = stats.issues * config.ISSUE_XP;
  const repositoriesXP = stats.repositories * config.REPOSITORY_XP;
  const starsXP = stats.stars * config.STAR_RECEIVED_XP;
  const contributionDaysXP = stats.contributionDays * config.CONTRIBUTION_DAY_XP;
  const streakBonusXP = stats.currentStreak * config.DAILY_STREAK_BONUS_XP;

  const totalXP =
    commitsXP +
    pullRequestsXP +
    mergedPullRequestsXP +
    issuesXP +
    repositoriesXP +
    starsXP +
    contributionDaysXP +
    streakBonusXP;

  return {
    commitsXP,
    pullRequestsXP,
    mergedPullRequestsXP,
    issuesXP,
    repositoriesXP,
    starsXP,
    contributionDaysXP,
    streakBonusXP,
    totalXP,
  };
}

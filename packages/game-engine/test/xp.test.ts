import { describe, it, expect } from 'vitest';
import { calculateXP, calculateXPBreakdown } from '../src/xp.js';
import { SCORING_RULES } from '@gitleague/config';

describe('Game Engine — XP Calculation', () => {
  it('calculates zero XP when all activity is zero', () => {
    const xp = calculateXP({
      commits: 0,
      pullRequests: 0,
      mergedPullRequests: 0,
      issues: 0,
      repositories: 0,
      stars: 0,
      contributionDays: 0,
      currentStreak: 0,
    });
    expect(xp).toBe(0);
  });

  it('calculates exact weighted XP for standard developer activity', () => {
    const stats = {
      commits: 100, // 100 * 10 = 1000
      pullRequests: 10, // 10 * 40 = 400
      mergedPullRequests: 5, // 5 * 60 = 300
      issues: 4, // 4 * 20 = 80
      repositories: 3, // 3 * 100 = 300
      stars: 20, // 20 * 5 = 100
      contributionDays: 25, // 25 * 10 = 250
      currentStreak: 12, // 12 * 15 = 180
    };

    const expectedXP = 1000 + 400 + 300 + 80 + 300 + 100 + 250 + 180; // 2610
    expect(calculateXP(stats)).toBe(expectedXP);
  });

  it('provides an accurate and itemized XP breakdown', () => {
    const stats = {
      commits: 50,
      pullRequests: 2,
      mergedPullRequests: 2,
      issues: 1,
      repositories: 1,
      stars: 10,
      contributionDays: 15,
      currentStreak: 5,
    };

    const breakdown = calculateXPBreakdown(stats);
    expect(breakdown.commitsXP).toBe(50 * SCORING_RULES.COMMIT_XP);
    expect(breakdown.pullRequestsXP).toBe(2 * SCORING_RULES.PULL_REQUEST_XP);
    expect(breakdown.mergedPullRequestsXP).toBe(2 * SCORING_RULES.MERGED_PULL_REQUEST_XP);
    expect(breakdown.issuesXP).toBe(1 * SCORING_RULES.ISSUE_XP);
    expect(breakdown.repositoriesXP).toBe(1 * SCORING_RULES.REPOSITORY_XP);
    expect(breakdown.starsXP).toBe(10 * SCORING_RULES.STAR_RECEIVED_XP);
    expect(breakdown.contributionDaysXP).toBe(15 * SCORING_RULES.CONTRIBUTION_DAY_XP);
    expect(breakdown.streakBonusXP).toBe(5 * SCORING_RULES.DAILY_STREAK_BONUS_XP);
    expect(breakdown.totalXP).toBe(
      breakdown.commitsXP +
        breakdown.pullRequestsXP +
        breakdown.mergedPullRequestsXP +
        breakdown.issuesXP +
        breakdown.repositoriesXP +
        breakdown.starsXP +
        breakdown.contributionDaysXP +
        breakdown.streakBonusXP
    );
  });

  it('safely handles negative numbers and NaN by clamping to 0', () => {
    const stats = {
      commits: -100 as unknown as number,
      pullRequests: NaN,
      mergedPullRequests: undefined as unknown as number,
      issues: -5,
      repositories: 0,
      stars: -50,
      contributionDays: -10,
      currentStreak: -2,
    };

    expect(calculateXP(stats)).toBe(0);
  });
});

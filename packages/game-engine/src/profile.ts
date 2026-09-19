import { ICalculatedGameProfile, IAchievementProgress } from '@gitleague/types';
import { SCORING_RULES, LEVEL_CONFIG, TIER_THRESHOLDS, INITIAL_ACHIEVEMENTS } from '@gitleague/config';
import { RawStatsInput, sanitizeStats } from './anti-abuse.js';
import { calculateXPBreakdown } from './xp.js';
import { calculateLevel, getLevelProgress } from './level.js';
import { calculateTier, getTierProgress } from './tier.js';
import { calculateRpgStats } from './stats.js';
import { calculateStreak } from './streak.js';
import { evaluateAchievements } from './achievements.js';

export interface ProfileCalculationOptions {
  contributionDates?: string[];
  previousAchievements?: IAchievementProgress[];
  referenceDate?: string | Date;
  scoringRules?: typeof SCORING_RULES;
  levelConfig?: typeof LEVEL_CONFIG;
  tierThresholds?: typeof TIER_THRESHOLDS;
}

/**
 * Master pure function calculating the complete deterministic game profile from raw GitHub metrics.
 */
export function calculateGameProfile(
  rawStats: RawStatsInput,
  options?: ProfileCalculationOptions
): ICalculatedGameProfile {
  const scoringConfig = options?.scoringRules ?? SCORING_RULES;
  const levelConfig = options?.levelConfig ?? LEVEL_CONFIG;
  const tierConfig = options?.tierThresholds ?? TIER_THRESHOLDS;
  const refDate = options?.referenceDate;

  // 1. Calculate streak if explicit dates are provided, or use provided streak counts
  let streakResult = {
    currentStreak: rawStats.currentStreak ?? 0,
    longestStreak: rawStats.longestStreak ?? 0,
    totalActiveDays: rawStats.contributionDays ?? 0,
    lastActiveDate: null as string | null,
  };

  if (options?.contributionDates && options.contributionDates.length > 0) {
    streakResult = calculateStreak(options.contributionDates, refDate);
  }

  // 2. Sanitize and bind stats
  const statsInput: RawStatsInput = {
    ...rawStats,
    currentStreak: Math.max(streakResult.currentStreak, rawStats.currentStreak ?? 0),
    longestStreak: Math.max(streakResult.longestStreak, rawStats.longestStreak ?? 0),
    contributionDays: Math.max(streakResult.totalActiveDays, rawStats.contributionDays ?? 0),
  };
  const sanitized = sanitizeStats(statsInput);

  // 3. Calculate XP & Breakdown
  const xpBreakdown = calculateXPBreakdown(sanitized, scoringConfig);
  const xp = xpBreakdown.totalXP;

  // 4. Calculate Level & Level Progression
  const level = calculateLevel(xp, levelConfig);
  const levelProgress = getLevelProgress(xp, levelConfig);

  // 5. Calculate Tier & Tier Progression
  const tier = calculateTier(level, xp, tierConfig);
  const tierProgress = getTierProgress(xp, level, tierConfig);

  // 6. Calculate RPG Attributes (0-100)
  const rpgStats = calculateRpgStats(sanitized);

  // 7. Evaluate Achievements
  const unlockTimestamp = refDate instanceof Date ? refDate : refDate ? new Date(refDate) : new Date();
  const achievements = evaluateAchievements(
    sanitized,
    options?.previousAchievements ?? [],
    INITIAL_ACHIEVEMENTS,
    unlockTimestamp
  );

  return {
    xp,
    level,
    tier,
    levelProgress,
    tierProgress,
    stats: rpgStats,
    streak: streakResult,
    achievements,
    xpBreakdown,
  };
}

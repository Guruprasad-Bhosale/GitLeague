import { LEVEL_CONFIG } from '@gitleague/config';
import { ILevelProgress } from '@gitleague/types';
import { clampNonNegative } from './anti-abuse.js';

export type LevelConfig = typeof LEVEL_CONFIG;

/**
 * Determines level from total XP.
 * Level 1 = 0-249 XP, Level 2 = 250-499 XP, etc.
 */
export function calculateLevel(xp: unknown, config: LevelConfig = LEVEL_CONFIG): number {
  const safeXp = clampNonNegative(xp);
  return Math.floor(safeXp / config.XP_PER_LEVEL) + 1;
}

/**
 * Alias for calculateLevel.
 */
export const getLevelFromXP = calculateLevel;

/**
 * Returns minimum base XP required to reach a given level.
 * Level 1 = 0 XP, Level 2 = 250 XP, Level 3 = 500 XP, etc.
 */
export function getXPForLevel(level: unknown, config: LevelConfig = LEVEL_CONFIG): number {
  const safeLevel = Math.max(1, clampNonNegative(level));
  return (safeLevel - 1) * config.XP_PER_LEVEL;
}

/**
 * Returns progress details within the current level.
 */
export function getLevelProgress(xp: unknown, config: LevelConfig = LEVEL_CONFIG): ILevelProgress {
  const safeXp = clampNonNegative(xp);
  const currentLevel = calculateLevel(safeXp, config);
  const currentLevelBaseXP = getXPForLevel(currentLevel, config);
  const nextLevelXP = getXPForLevel(currentLevel + 1, config);
  const xpInCurrentLevel = safeXp - currentLevelBaseXP;
  const xpRequiredForNextLevel = config.XP_PER_LEVEL;
  const progressPercentage = Math.min(100, Math.floor((xpInCurrentLevel / xpRequiredForNextLevel) * 100));

  return {
    currentLevel,
    currentLevelBaseXP,
    nextLevelXP,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    progressPercentage,
  };
}

/**
 * Returns remaining XP required to advance to the next level.
 */
export function getXPToNextLevel(xp: unknown, config: LevelConfig = LEVEL_CONFIG): number {
  const progress = getLevelProgress(xp, config);
  return progress.xpRequiredForNextLevel - progress.xpInCurrentLevel;
}

import { LeagueTier, ITierProgress } from '@gitleague/types';
import { TIER_THRESHOLDS } from '@gitleague/config';
import { calculateLevel } from './level.js';
import { clampNonNegative } from './anti-abuse.js';

export type TierConfig = typeof TIER_THRESHOLDS;

const TIER_ORDER: LeagueTier[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
];

/**
 * Determines league tier based on XP and Level.
 */
export function calculateTier(
  level: unknown,
  xp: unknown,
  thresholds: TierConfig = TIER_THRESHOLDS
): LeagueTier {
  const safeXp = clampNonNegative(xp);
  const safeLevel = Math.max(1, clampNonNegative(level));

  if (safeLevel >= thresholds.GRANDMASTER.minLevel && safeXp >= thresholds.GRANDMASTER.minXp) return 'GRANDMASTER';
  if (safeLevel >= thresholds.MASTER.minLevel && safeXp >= thresholds.MASTER.minXp) return 'MASTER';
  if (safeLevel >= thresholds.DIAMOND.minLevel && safeXp >= thresholds.DIAMOND.minXp) return 'DIAMOND';
  if (safeLevel >= thresholds.PLATINUM.minLevel && safeXp >= thresholds.PLATINUM.minXp) return 'PLATINUM';
  if (safeLevel >= thresholds.GOLD.minLevel && safeXp >= thresholds.GOLD.minXp) return 'GOLD';
  if (safeLevel >= thresholds.SILVER.minLevel && safeXp >= thresholds.SILVER.minXp) return 'SILVER';
  return 'BRONZE';
}

/**
 * Helper to determine tier from XP directly.
 */
export function getTierFromXP(
  xp: unknown,
  level?: unknown,
  thresholds: TierConfig = TIER_THRESHOLDS
): LeagueTier {
  const safeXp = clampNonNegative(xp);
  const derivedLevel = level !== undefined ? Math.max(1, clampNonNegative(level)) : calculateLevel(safeXp);
  return calculateTier(derivedLevel, safeXp, thresholds);
}

/**
 * Returns progression towards the next competitive league tier.
 */
export function getTierProgress(
  xp: unknown,
  level?: unknown,
  thresholds: TierConfig = TIER_THRESHOLDS
): ITierProgress {
  const safeXp = clampNonNegative(xp);
  const currentTier = getTierFromXP(safeXp, level, thresholds);
  const tierDetails = thresholds[currentTier];

  const currentTierIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier: LeagueTier | null =
    currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;

  const currentTierMinXP = tierDetails.minXp;
  const nextTierMinXP = nextTier ? thresholds[nextTier].minXp : null;

  let xpToNextTier = 0;
  let tierProgressPercentage = 100;

  if (nextTier && nextTierMinXP !== null) {
    xpToNextTier = Math.max(0, nextTierMinXP - safeXp);
    const range = nextTierMinXP - currentTierMinXP;
    const progress = safeXp - currentTierMinXP;
    tierProgressPercentage = range > 0 ? Math.min(100, Math.max(0, Math.floor((progress / range) * 100))) : 0;
  }

  return {
    currentTier,
    nextTier,
    currentTierMinXP,
    nextTierMinXP,
    xpToNextTier,
    tierProgressPercentage,
    title: tierDetails.title,
    color: tierDetails.color,
  };
}

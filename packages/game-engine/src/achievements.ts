import {
  IAchievementProgress,
  IAchievementDefinition,
  AchievementRarityLabel,
} from '@gitleague/types';
import { INITIAL_ACHIEVEMENTS, RARITY_THRESHOLDS } from '@gitleague/config';
import { RawStatsInput, sanitizeStats } from './anti-abuse.js';

export interface EvaluatedAchievement extends IAchievementProgress {
  title: string;
  description: string;
  category: string;
  icon: string;
  xpReward: number;
  maxProgress: number;
  progressPercentage: number;
}

/**
 * Data-driven evaluation of user achievements based on sanitized stats and existing unlock history.
 */
export function evaluateAchievements(
  rawStats: RawStatsInput,
  currentProgress: IAchievementProgress[] = [],
  definitions: IAchievementDefinition[] = INITIAL_ACHIEVEMENTS,
  unlockTimestamp: Date = new Date()
): EvaluatedAchievement[] {
  const stats = sanitizeStats(rawStats);
  const progressMap = new Map(currentProgress.map((p) => [p.id, p]));

  return definitions.map((ach) => {
    const existing = progressMap.get(ach.id);
    let progress = 0;

    switch (ach.category) {
      case 'streak':
        // Evaluate against longest streak or current streak
        progress = Math.min(Math.max(stats.currentStreak, stats.longestStreak || 0), ach.maxProgress);
        break;
      case 'commits':
        progress = Math.min(stats.commits, ach.maxProgress);
        break;
      case 'builder':
        progress = Math.min(stats.repositories, ach.maxProgress);
        break;
      case 'open_source':
        progress = Math.min(stats.mergedPullRequests, ach.maxProgress);
        break;
      case 'stars':
        progress = Math.min(stats.stars, ach.maxProgress);
        break;
      default:
        progress = 0;
    }

    const isUnlocked = progress >= ach.maxProgress;
    const unlockedAt = isUnlocked
      ? existing?.unlockedAt && existing.isUnlocked
        ? existing.unlockedAt
        : unlockTimestamp
      : new Date(0);

    const progressPercentage = Math.min(100, Math.floor((progress / ach.maxProgress) * 100));

    return {
      id: ach.id,
      title: ach.title,
      description: ach.description,
      category: ach.category,
      icon: ach.icon,
      xpReward: ach.xpReward,
      maxProgress: ach.maxProgress,
      progress,
      progressPercentage,
      isUnlocked,
      unlockedAt,
    };
  });
}

/**
 * Dynamically compute factual achievement rarity percentage and label
 */
export function calculateRarity(
  unlockedCount: number,
  totalEligibleParticipants: number
): { rarityPercent: number; rarityLabel: AchievementRarityLabel; color: string } {
  if (totalEligibleParticipants <= 0 || unlockedCount <= 0) {
    return {
      rarityPercent: 0,
      rarityLabel: 'Legendary',
      color: '#F59E0B',
    };
  }

  const rawPercent = (unlockedCount / totalEligibleParticipants) * 100;
  const rarityPercent = Number(Math.min(100, Math.max(0, rawPercent)).toFixed(2));

  for (const threshold of RARITY_THRESHOLDS) {
    if (rarityPercent >= threshold.minPercent) {
      return {
        rarityPercent,
        rarityLabel: threshold.label,
        color: threshold.color,
      };
    }
  }

  return {
    rarityPercent,
    rarityLabel: 'Legendary',
    color: '#F59E0B',
  };
}


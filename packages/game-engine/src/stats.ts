import { IRpgStats } from '@gitleague/types';
import { RawStatsInput, sanitizeStats } from './anti-abuse.js';

export interface RpgStatWeights {
  coding: { commitsWeight: number; baseOffset: number };
  consistency: { streakWeight: number; daysWeight: number };
  builder: { repoWeight: number; starWeight: number };
  openSource: { prIssueWeight: number };
}

export const DEFAULT_STAT_WEIGHTS: RpgStatWeights = {
  coding: { commitsWeight: 28, baseOffset: 15 },
  consistency: { streakWeight: 50, daysWeight: 50 },
  builder: { repoWeight: 4.5, starWeight: 0.25 },
  openSource: { prIssueWeight: 2.0 },
};

/**
 * Computes RPG attributes (Coding, Consistency, Builder, Open Source) strictly bounded between 0 and 100.
 */
export function calculateRpgStats(
  rawStats: RawStatsInput,
  weights: RpgStatWeights = DEFAULT_STAT_WEIGHTS
): IRpgStats {
  const stats = sanitizeStats(rawStats);

  // Coding: Logarithmic scaling based on lifetime commits (100 commits ~ 71, 1000 commits ~ 99)
  const codingLog = stats.commits > 0 ? Math.log10(stats.commits) * weights.coding.commitsWeight : 0;
  const coding = Math.min(100, Math.max(0, Math.floor(codingLog + (stats.commits > 0 ? weights.coding.baseOffset : 0))));

  // Consistency: Scaling based on active streak and total annual contribution days
  const streakPart = (Math.min(stats.currentStreak, 30) / 30) * weights.consistency.streakWeight;
  const daysPart = (Math.min(stats.contributionDays, 365) / 365) * weights.consistency.daysWeight;
  const consistency = Math.min(100, Math.max(0, Math.floor(streakPart + daysPart)));

  // Builder: Scaling based on original authored repositories (capped at 20) and stars (capped at 100)
  const repoPart = Math.min(stats.repositories, 20) * weights.builder.repoWeight;
  const starPart = Math.min(stats.stars, 100) * weights.builder.starWeight;
  const builder = Math.min(100, Math.max(0, Math.floor(repoPart + starPart)));

  // Open Source: Scaling based on merged pull requests and opened issues
  const openSourceRaw = Math.min(stats.mergedPullRequests * 2 + stats.issues, 50) * weights.openSource.prIssueWeight;
  const openSource = Math.min(100, Math.max(0, Math.floor(openSourceRaw)));

  return {
    coding,
    consistency,
    builder,
    openSource,
  };
}

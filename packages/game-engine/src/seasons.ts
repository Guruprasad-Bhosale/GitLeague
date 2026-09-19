import type { SeasonStatus, IUserSeasonHistoryItem, ISeasonPersonalBests } from '@gitleague/types';

/**
 * Pure function to determine a season's status based on UTC timestamps and a reference date.
 */
export function getSeasonStatus(
  startDate: Date | string,
  endDate: Date | string,
  referenceDate: Date | string = new Date()
): SeasonStatus {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const ref = new Date(referenceDate).getTime();

  if (ref < start) {
    return 'upcoming';
  }
  if (ref >= end) {
    return 'completed';
  }
  return 'active';
}

/**
 * Checks if a season is active at the given reference date.
 */
export function isSeasonActive(
  startDate: Date | string,
  endDate: Date | string,
  referenceDate: Date | string = new Date()
): boolean {
  return getSeasonStatus(startDate, endDate, referenceDate) === 'active';
}

/**
 * Checks if a season is upcoming at the given reference date.
 */
export function isSeasonUpcoming(
  startDate: Date | string,
  endDate: Date | string,
  referenceDate: Date | string = new Date()
): boolean {
  return getSeasonStatus(startDate, endDate, referenceDate) === 'upcoming';
}

/**
 * Checks if a season is completed at the given reference date.
 */
export function isSeasonCompleted(
  startDate: Date | string,
  endDate: Date | string,
  referenceDate: Date | string = new Date()
): boolean {
  return getSeasonStatus(startDate, endDate, referenceDate) === 'completed';
}

/**
 * Validates whether a proposed season state transition is allowed.
 * Valid transitions: upcoming -> active, active -> completed, upcoming -> completed.
 * Invalid: completed -> active, completed -> upcoming, active -> upcoming.
 */
export function isValidSeasonTransition(fromStatus: SeasonStatus, toStatus: SeasonStatus): boolean {
  if (fromStatus === toStatus) return true;

  if (fromStatus === 'upcoming') {
    return toStatus === 'active' || toStatus === 'completed';
  }

  if (fromStatus === 'active') {
    return toStatus === 'completed';
  }

  // fromStatus === 'completed' cannot transition to anything else
  return false;
}

/**
 * Deterministic ranking sort for season participants:
 * 1. seasonXP DESC
 * 2. level DESC
 * 3. userId ASC (lexicographical)
 */
export function sortSeasonParticipantsDeterministically<
  T extends { seasonXP: number; level: number; userId: string | { toString(): string } }
>(participants: T[]): T[] {
  return [...participants].sort((a, b) => {
    if (b.seasonXP !== a.seasonXP) {
      return b.seasonXP - a.seasonXP;
    }
    if (b.level !== a.level) {
      return b.level - a.level;
    }
    const idA = typeof a.userId === 'string' ? a.userId : a.userId.toString();
    const idB = typeof b.userId === 'string' ? b.userId : b.userId.toString();
    return idA.localeCompare(idB);
  });
}

/**
 * Computes factual season personal bests from completed season history.
 */
export function calculateSeasonPersonalBests(history: IUserSeasonHistoryItem[]): ISeasonPersonalBests {
  if (!history || history.length === 0) {
    return {
      bestRank: null,
      bestXP: null,
      seasonsParticipated: 0,
    };
  }

  let bestRankItem: IUserSeasonHistoryItem | null = null;
  let bestXPItem: IUserSeasonHistoryItem | null = null;

  for (const item of history) {
    if (item.finalRank > 0) {
      if (!bestRankItem || item.finalRank < bestRankItem.finalRank) {
        bestRankItem = item;
      }
    }

    if (item.finalXP >= 0) {
      if (!bestXPItem || item.finalXP > bestXPItem.finalXP) {
        bestXPItem = item;
      }
    }
  }

  return {
    bestRank: bestRankItem
      ? {
          seasonSlug: bestRankItem.season.slug,
          seasonName: bestRankItem.season.name,
          rank: bestRankItem.finalRank,
        }
      : null,
    bestXP: bestXPItem
      ? {
          seasonSlug: bestXPItem.season.slug,
          seasonName: bestXPItem.season.name,
          xp: bestXPItem.finalXP,
        }
      : null,
    seasonsParticipated: history.length,
  };
}

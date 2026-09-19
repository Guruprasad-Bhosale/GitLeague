import { IRankMovement, RankDirection } from '@gitleague/types';

/**
 * Pure calculation of rank delta and direction comparing a historical snapshot rank to current rank
 */
export function calculateRankMovement(
  previousRank: number | null | undefined,
  currentRank: number
): IRankMovement {
  if (previousRank === null || previousRank === undefined || previousRank <= 0) {
    return {
      previousRank: null,
      currentRank,
      movement: 0,
      direction: 'new',
    };
  }

  if (previousRank > currentRank) {
    return {
      previousRank,
      currentRank,
      movement: previousRank - currentRank,
      direction: 'up',
    };
  }

  if (previousRank < currentRank) {
    return {
      previousRank,
      currentRank,
      movement: currentRank - previousRank,
      direction: 'down',
    };
  }

  return {
    previousRank,
    currentRank,
    movement: 0,
    direction: 'same',
  };
}

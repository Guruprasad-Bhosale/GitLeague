import { describe, it, expect } from 'vitest';
import { calculateRankMovement } from '../src/rank-movement.js';

describe('Game Engine — Rank Movement Tracking', () => {
  it('returns direction: "up" and positive movement when current rank improved', () => {
    const previousRank = 10;
    const currentRank = 7;
    const result = calculateRankMovement(previousRank, currentRank);
    expect(result.direction).toBe('up');
    expect(result.movement).toBe(3);
    expect(result.previousRank).toBe(10);
    expect(result.currentRank).toBe(7);
  });

  it('returns direction: "down" and movement when rank dropped', () => {
    const previousRank = 5;
    const currentRank = 8;
    const result = calculateRankMovement(previousRank, currentRank);
    expect(result.direction).toBe('down');
    expect(result.movement).toBe(3);
    expect(result.previousRank).toBe(5);
    expect(result.currentRank).toBe(8);
  });

  it('returns direction: "same" and movement: 0 when rank unchanged', () => {
    const previousRank = 4;
    const currentRank = 4;
    const result = calculateRankMovement(previousRank, currentRank);
    expect(result.direction).toBe('same');
    expect(result.movement).toBe(0);
  });

  it('returns direction: "new" when no previous snapshot exists', () => {
    const resultNull = calculateRankMovement(null, 15);
    expect(resultNull.direction).toBe('new');
    expect(resultNull.movement).toBe(0);
    expect(resultNull.previousRank).toBeNull();

    const resultUndefined = calculateRankMovement(undefined, 22);
    expect(resultUndefined.direction).toBe('new');
  });
});

import { describe, it, expect } from 'vitest';
import { calculateLevel, getXPForLevel, getLevelProgress, getXPToNextLevel } from '../src/level.js';

describe('Game Engine — Level Progression', () => {
  it('calculates level correctly across boundaries', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(100)).toBe(1);
    expect(calculateLevel(249)).toBe(1);
    expect(calculateLevel(250)).toBe(2);
    expect(calculateLevel(499)).toBe(2);
    expect(calculateLevel(500)).toBe(3);
    expect(calculateLevel(2500)).toBe(11);
    expect(calculateLevel(25000)).toBe(101);
  });

  it('safely handles negative XP and NaN inputs by defaulting to Level 1', () => {
    expect(calculateLevel(-500)).toBe(1);
    expect(calculateLevel(NaN)).toBe(1);
    expect(calculateLevel(null)).toBe(1);
  });

  it('returns exact base XP for any target level', () => {
    expect(getXPForLevel(1)).toBe(0);
    expect(getXPForLevel(2)).toBe(250);
    expect(getXPForLevel(3)).toBe(500);
    expect(getXPForLevel(10)).toBe(2250);
  });

  it('calculates level progress percentage and XP breakdown within level', () => {
    const progress = getLevelProgress(2840);
    expect(progress.currentLevel).toBe(12); // (2840 / 250) + 1 = 12
    expect(progress.currentLevelBaseXP).toBe(2750); // 11 * 250 = 2750
    expect(progress.nextLevelXP).toBe(3000); // 12 * 250 = 3000
    expect(progress.xpInCurrentLevel).toBe(90); // 2840 - 2750 = 90
    expect(progress.xpRequiredForNextLevel).toBe(250);
    expect(progress.progressPercentage).toBe(36); // Math.floor(90 / 250 * 100) = 36%

    expect(getXPToNextLevel(2840)).toBe(160); // 250 - 90 = 160
  });
});

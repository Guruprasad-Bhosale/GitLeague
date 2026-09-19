import { describe, it, expect } from 'vitest';
import { calculateRpgStats } from '../src/stats.js';

describe('Game Engine — RPG Attributes (0-100 Bounded)', () => {
  it('calculates bounded RPG attributes for zero activity', () => {
    const stats = calculateRpgStats({
      commits: 0,
      pullRequests: 0,
      mergedPullRequests: 0,
      issues: 0,
      repositories: 0,
      stars: 0,
      contributionDays: 0,
      currentStreak: 0,
    });

    expect(stats.coding).toBeGreaterThanOrEqual(0);
    expect(stats.coding).toBeLessThanOrEqual(100);
    expect(stats.consistency).toBeGreaterThanOrEqual(0);
    expect(stats.builder).toBeGreaterThanOrEqual(0);
    expect(stats.openSource).toBeGreaterThanOrEqual(0);
  });

  it('keeps attributes strictly within [0, 100] even for massive activity inputs', () => {
    const stats = calculateRpgStats({
      commits: 100000,
      pullRequests: 5000,
      mergedPullRequests: 4000,
      issues: 2000,
      repositories: 500,
      stars: 50000,
      contributionDays: 1000,
      currentStreak: 500,
    });

    expect(stats.coding).toBeLessThanOrEqual(100);
    expect(stats.consistency).toBeLessThanOrEqual(100);
    expect(stats.builder).toBeLessThanOrEqual(100);
    expect(stats.openSource).toBeLessThanOrEqual(100);

    expect(stats.coding).toBe(100);
    expect(stats.consistency).toBe(100);
    expect(stats.builder).toBe(100);
    expect(stats.openSource).toBe(100);
  });

  it('produces expected balanced stats for standard developer activity', () => {
    const stats = calculateRpgStats({
      commits: 500,
      pullRequests: 20,
      mergedPullRequests: 15,
      issues: 10,
      repositories: 12,
      stars: 45,
      contributionDays: 120,
      currentStreak: 18,
    });

    expect(stats.coding).toBeGreaterThanOrEqual(60);
    expect(stats.consistency).toBeGreaterThanOrEqual(40);
    expect(stats.builder).toBeGreaterThanOrEqual(60);
    expect(stats.openSource).toBeGreaterThanOrEqual(50);
  });
});

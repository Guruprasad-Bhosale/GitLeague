import { describe, it, expect } from 'vitest';
import { evaluateAchievements } from '../src/achievements.js';

describe('Game Engine — Data-Driven Achievements', () => {
  it('evaluates progress and unlock status accurately', () => {
    const stats = {
      commits: 550, // unlocks commit_machine_500 (max: 500)
      pullRequests: 30,
      mergedPullRequests: 26, // unlocks open_source_hero (max: 25)
      issues: 10,
      repositories: 5, // progress 5 / 10 for builder_10
      stars: 80, // progress 80 / 100 for star_collector_100
      contributionDays: 45,
      currentStreak: 15, // progress 15 / 30 for streak_master_30
    };

    const achievements = evaluateAchievements(stats, [], undefined, new Date('2026-09-16T12:00:00Z'));

    const commitMachine = achievements.find((a) => a.id === 'commit_machine_500');
    expect(commitMachine?.isUnlocked).toBe(true);
    expect(commitMachine?.progress).toBe(500); // capped at maxProgress
    expect(commitMachine?.progressPercentage).toBe(100);

    const openSourceHero = achievements.find((a) => a.id === 'open_source_hero');
    expect(openSourceHero?.isUnlocked).toBe(true);
    expect(openSourceHero?.progress).toBe(25);

    const builder = achievements.find((a) => a.id === 'builder_10');
    expect(builder?.isUnlocked).toBe(false);
    expect(builder?.progress).toBe(5);
    expect(builder?.progressPercentage).toBe(50);

    const streakMaster = achievements.find((a) => a.id === 'streak_master_30');
    expect(streakMaster?.isUnlocked).toBe(false);
    expect(streakMaster?.progress).toBe(15);
    expect(streakMaster?.progressPercentage).toBe(50);
  });

  it('preserves existing unlock timestamp for already unlocked achievements', () => {
    const historicalUnlockDate = new Date('2025-01-01T00:00:00Z');
    const existingProgress = [
      {
        id: 'commit_machine_500',
        progress: 500,
        isUnlocked: true,
        unlockedAt: historicalUnlockDate,
      },
    ];

    const currentStats = {
      commits: 600,
      pullRequests: 0,
      mergedPullRequests: 0,
      issues: 0,
      repositories: 0,
      stars: 0,
      contributionDays: 0,
      currentStreak: 0,
    };

    const achievements = evaluateAchievements(
      currentStats,
      existingProgress,
      undefined,
      new Date('2026-09-16T00:00:00Z')
    );

    const commitMachine = achievements.find((a) => a.id === 'commit_machine_500');
    expect(commitMachine?.isUnlocked).toBe(true);
    expect(commitMachine?.unlockedAt).toEqual(historicalUnlockDate);
  });
});

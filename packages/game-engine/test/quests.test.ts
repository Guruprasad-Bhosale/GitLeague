import { describe, it, expect } from 'vitest';
import {
  getDailyQuestPeriod,
  getWeeklyQuestPeriod,
  getQuestsForPeriod,
  calculateQuestProgress,
  calculateTotalLifetimeXp,
  stableHashString,
} from '../src/quests.js';
import { IQuestDefinition, IQuestActivityItem } from '@gitleague/types';

describe('Game Engine — Quests & Rotations', () => {
  it('computes daily and weekly periods deterministically in UTC', () => {
    const fixedNow = new Date('2026-09-17T14:30:00Z');
    const dailyPeriod = getDailyQuestPeriod(fixedNow);
    expect(dailyPeriod.periodKey).toBe('daily:2026-09-17');
    expect(dailyPeriod.startDate.toISOString()).toBe('2026-09-17T00:00:00.000Z');
    expect(dailyPeriod.endDate.toISOString()).toBe('2026-09-17T23:59:59.999Z');

    const weeklyPeriod = getWeeklyQuestPeriod(fixedNow);
    expect(weeklyPeriod.periodKey).toBe('weekly:2026-W38');
    expect(weeklyPeriod.startDate.getUTCDay()).toBe(1); // Monday
    expect(weeklyPeriod.endDate.getTime() - weeklyPeriod.startDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000 - 1);
  });

  it('rotates quests deterministically using stableHashString', () => {
    const hash1 = stableHashString('2026-09-17');
    const hash2 = stableHashString('2026-09-17');
    expect(hash1).toBe(hash2);

    const dailyQuests1 = getQuestsForPeriod('daily', '2026-09-17');
    const dailyQuests2 = getQuestsForPeriod('daily', '2026-09-17');
    expect(dailyQuests1).toHaveLength(3);
    expect(dailyQuests1.map((q) => q.id)).toEqual(dailyQuests2.map((q) => q.id));

    const weeklyQuests = getQuestsForPeriod('weekly', '2026-W38');
    expect(weeklyQuests).toHaveLength(3);
  });

  it('filters activity by quest period and computes commit metrics accurately', () => {
    const quest: IQuestDefinition = {
      id: 'daily_commits_3',
      name: 'Daily Committer',
      description: 'Push at least 3 commits today',
      type: 'daily',
      metric: 'commits',
      target: 3,
      rewardXP: 100,
      difficulty: 'easy',
    };

    const period = {
      periodKey: '2026-09-17',
      startDate: new Date('2026-09-17T00:00:00Z'),
      endDate: new Date('2026-09-18T00:00:00Z'),
    };

    const activities: IQuestActivityItem[] = [
      // Within period
      {
        type: 'PushEvent',
        createdAt: '2026-09-17T08:00:00Z',
        payload: { commitsCount: 2 },
      },
      // Within period
      {
        type: 'PushEvent',
        createdAt: '2026-09-17T12:00:00Z',
        payload: { commitsCount: 1 },
      },
      // Outside period (yesterday)
      {
        type: 'PushEvent',
        createdAt: '2026-09-16T23:59:00Z',
        payload: { commitsCount: 10 },
      },
    ];

    const result = calculateQuestProgress(quest, activities, period);
    expect(result.progress).toBe(3);
    expect(result.completed).toBe(true);
  });

  it('evaluates pull requests and merged PR metrics within quest period', () => {
    const quest: IQuestDefinition = {
      id: 'weekly_pr_merge_3',
      name: 'Merge Master',
      description: 'Get 3 pull requests merged this week',
      type: 'weekly',
      metric: 'merged_pull_requests',
      target: 3,
      rewardXP: 300,
      difficulty: 'medium',
    };

    const period = {
      periodKey: '2026-W38',
      startDate: new Date('2026-09-14T00:00:00Z'),
      endDate: new Date('2026-09-21T00:00:00Z'),
    };

    const activities: IQuestActivityItem[] = [
      {
        type: 'PullRequestEvent',
        createdAt: '2026-09-15T10:00:00Z',
        payload: { isMerged: true },
      },
      {
        type: 'PullRequestEvent',
        createdAt: '2026-09-16T10:00:00Z',
        payload: { action: 'closed', isMerged: true },
      },
      {
        type: 'PullRequestEvent',
        createdAt: '2026-09-17T10:00:00Z',
        payload: { action: 'opened', isMerged: false }, // Opened but not merged
      },
    ];

    const result = calculateQuestProgress(quest, activities, period);
    expect(result.progress).toBe(2);
    expect(result.completed).toBe(false);
  });

  it('sums total lifetime XP correctly from githubXP and questXP', () => {
    const githubXP = 5000;
    const questXP = 750;
    const total = calculateTotalLifetimeXp(githubXP, questXP);
    expect(total).toBe(5750);
  });
});

import { describe, it, expect } from 'vitest';
import { scoreActivityEvents } from '../src/scoring.js';

describe('Game Engine — Activity Event Scoring & Deduplication', () => {
  it('scores fresh events and records processed IDs', () => {
    const events = [
      { id: 'evt-1', type: 'PushEvent', payload: { commitsCount: 3 } }, // 3 * 10 = 30 XP
      { id: 'evt-2', type: 'PullRequestEvent', payload: { action: 'opened' } }, // 40 XP
      { id: 'evt-3', type: 'PullRequestEvent', payload: { isMerged: true } }, // 60 XP
      { id: 'evt-4', type: 'IssuesEvent', payload: { action: 'opened' } }, // 20 XP
    ];

    const result = scoreActivityEvents(events);
    expect(result.awardedXP).toBe(30 + 40 + 60 + 20); // 150
    expect(result.processedEventIds).toEqual(['evt-1', 'evt-2', 'evt-3', 'evt-4']);
    expect(result.skippedDuplicateCount).toBe(0);
  });

  it('skips duplicate events without double-awarding XP', () => {
    const alreadyProcessed = new Set(['evt-1', 'evt-2']);
    const events = [
      { id: 'evt-1', type: 'PushEvent', payload: { commitsCount: 5 } }, // duplicate, skip
      { id: 'evt-2', type: 'PullRequestEvent', payload: { action: 'opened' } }, // duplicate, skip
      { id: 'evt-3', type: 'IssuesEvent', payload: { action: 'opened' } }, // new -> 20 XP
    ];

    const result = scoreActivityEvents(events, alreadyProcessed);
    expect(result.awardedXP).toBe(20);
    expect(result.processedEventIds).toEqual(['evt-3']);
    expect(result.skippedDuplicateCount).toBe(2);
  });
});

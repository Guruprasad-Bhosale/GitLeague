import { describe, it, expect } from 'vitest';
import { calculateStreak } from '../src/streak.js';

describe('Game Engine — Deterministic Streak Engine', () => {
  it('returns zero streaks for empty or invalid date arrays', () => {
    expect(calculateStreak([])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      lastActiveDate: null,
    });
    expect(calculateStreak(['invalid-date', 'not-a-date'])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      lastActiveDate: null,
    });
  });

  it('calculates active consecutive streak ending on reference date', () => {
    const dates = ['2026-09-14', '2026-09-15', '2026-09-16'];
    const result = calculateStreak(dates, '2026-09-16');

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.totalActiveDays).toBe(3);
    expect(result.lastActiveDate).toBe('2026-09-16');
  });

  it('keeps streak alive if last active date was yesterday', () => {
    const dates = ['2026-09-13', '2026-09-14', '2026-09-15'];
    // Reference date is 2026-09-16 (today), activity was on 2026-09-15 (yesterday)
    const result = calculateStreak(dates, '2026-09-16');

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.totalActiveDays).toBe(3);
  });

  it('resets current streak to 0 if activity is older than 1 day ago', () => {
    const dates = ['2026-09-10', '2026-09-11', '2026-09-12'];
    // Reference date is 2026-09-16
    const result = calculateStreak(dates, '2026-09-16');

    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(3);
    expect(result.totalActiveDays).toBe(3);
  });

  it('calculates historical longest streak with intermittent gaps', () => {
    const dates = [
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05', // 5-day streak
      '2026-08-10', // gap
      '2026-08-11', // 2-day streak
      '2026-09-15', // gap
      '2026-09-16', // 2-day current streak
    ];
    const result = calculateStreak(dates, '2026-09-16');

    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
    expect(result.totalActiveDays).toBe(9);
  });

  it('handles unsorted dates and duplicates deterministically', () => {
    const dates = [
      '2026-09-15T14:32:00Z',
      '2026-09-14',
      '2026-09-16',
      '2026-09-15',
      '2026-09-14T09:12:00Z',
    ];
    const result = calculateStreak(dates, '2026-09-16');

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.totalActiveDays).toBe(3);
  });

  it('ignores future dates beyond the reference date', () => {
    const dates = ['2026-09-15', '2026-09-16', '2026-09-20', '2026-09-21'];
    const result = calculateStreak(dates, '2026-09-16');

    expect(result.currentStreak).toBe(2);
    expect(result.totalActiveDays).toBe(2);
    expect(result.lastActiveDate).toBe('2026-09-16');
  });
});

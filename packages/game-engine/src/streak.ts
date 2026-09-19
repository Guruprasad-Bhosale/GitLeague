import { IStreakResult } from '@gitleague/types';

/**
 * Normalizes Date or YYYY-MM-DD string into a standard YYYY-MM-DD string.
 */
function toDateString(d: string | Date): string {
  if (typeof d === 'string') {
    // If it's an ISO timestamp or date string, extract first 10 characters (YYYY-MM-DD)
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the calendar day difference (target - base) in integer days (UTC).
 */
function getDayDifference(dateStrA: string, dateStrB: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const timeA = Date.UTC(
    Number(dateStrA.slice(0, 4)),
    Number(dateStrA.slice(5, 7)) - 1,
    Number(dateStrA.slice(8, 10))
  );
  const timeB = Date.UTC(
    Number(dateStrB.slice(0, 4)),
    Number(dateStrB.slice(5, 7)) - 1,
    Number(dateStrB.slice(8, 10))
  );
  return Math.round((timeB - timeA) / msPerDay);
}

/**
 * Calculates deterministic streaks from an array of contribution dates.
 *
 * @param dates - Array of ISO date strings (e.g. ['2026-09-14', '2026-09-15'])
 * @param referenceDate - Reference date (defaults to current date if omitted, but explicit date recommended for tests)
 */
export function calculateStreak(
  dates: string[] = [],
  referenceDate?: string | Date
): IStreakResult {
  if (!Array.isArray(dates) || dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      lastActiveDate: null,
    };
  }

  const refDateStr = referenceDate ? toDateString(referenceDate) : new Date().toISOString().slice(0, 10);

  // Filter valid YYYY-MM-DD dates, exclude future dates beyond referenceDate, and deduplicate
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  const uniqueDates = Array.from(
    new Set(
      dates
        .map((d) => (typeof d === 'string' ? d.slice(0, 10) : ''))
        .filter((d) => DATE_REGEX.test(d) && d <= refDateStr)
    )
  ).sort();

  const totalActiveDays = uniqueDates.length;
  if (totalActiveDays === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      lastActiveDate: null,
    };
  }

  const lastActiveDate = uniqueDates[uniqueDates.length - 1];

  // 1. Calculate longest streak across entire sorted history
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const diff = getDayDifference(uniqueDates[i - 1], uniqueDates[i]);
    if (diff === 1) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 1;
    }
  }

  // 2. Calculate current streak (active today or yesterday)
  let currentStreak = 0;
  const daysSinceLastActive = getDayDifference(lastActiveDate, refDateStr);

  // A streak is active if the last activity was today (diff = 0) or yesterday (diff = 1)
  if (daysSinceLastActive <= 1) {
    currentStreak = 1;
    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const diff = getDayDifference(uniqueDates[i - 1], uniqueDates[i]);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays,
    lastActiveDate,
  };
}

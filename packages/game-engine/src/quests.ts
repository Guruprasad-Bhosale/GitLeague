import { IQuestDefinition, QuestType, IQuestActivityItem } from '@gitleague/types';
import { QUEST_CATALOG } from '@gitleague/config';

export interface QuestPeriod {
  periodKey: string;
  type: QuestType;
  startDate: Date;
  endDate: Date;
}

export interface QuestProgressResult {
  progress: number;
  target: number;
  completed: boolean;
  completedAt: Date | null;
}

/**
 * Deterministically compute UTC Daily Quest Period (00:00:00.000Z to 23:59:59.999Z)
 */
export function getDailyQuestPeriod(refDate: Date = new Date()): QuestPeriod {
  const d = new Date(refDate);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const periodKey = `daily:${year}-${month}-${day}`;

  const startDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

  return { periodKey, type: 'daily', startDate, endDate };
}

/**
 * Deterministically compute ISO Weekly Quest Period (Monday 00:00:00.000Z to Sunday 23:59:59.999Z)
 */
export function getWeeklyQuestPeriod(refDate: Date = new Date()): QuestPeriod {
  const d = new Date(refDate);
  // Day of week: 0 is Sunday, 1 is Monday ... 6 is Saturday
  const dayOfWeek = d.getUTCDay();
  // Calculate distance to Monday (if Sunday=0, distance is -6; else 1 - dayOfWeek)
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + distanceToMonday, 0, 0, 0, 0));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6, 23, 59, 59, 999));

  // Compute ISO Week Number
  const jan4 = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4));
  const dayOfYear = Math.floor((monday.getTime() - new Date(Date.UTC(monday.getUTCFullYear(), 0, 1)).getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + ((jan4.getUTCDay() || 7) - 1)) / 7);
  const periodKey = `weekly:${monday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  return { periodKey, type: 'weekly', startDate: monday, endDate: sunday };
}

/**
 * Stable 32-bit string hashing for deterministic selection without Math.random()
 */
export function stableHashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Deterministically rotate and select active quests for a given period key
 */
export function getQuestsForPeriod(
  type: QuestType,
  periodKey: string,
  catalog: IQuestDefinition[] = QUEST_CATALOG,
  count = 3
): IQuestDefinition[] {
  const matching = catalog.filter((q) => q.type === type);
  if (matching.length <= count) return matching;

  const seed = stableHashString(periodKey);
  const selected: IQuestDefinition[] = [];
  const pool = [...matching];

  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 3) % pool.length;
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected;
}

/**
 * Calculate quest progress strictly filtered by activity timestamps within the quest period
 */
export function calculateQuestProgress(
  quest: IQuestDefinition,
  activityItems: IQuestActivityItem[] = [],
  period: QuestPeriod
): QuestProgressResult {
  const startMs = period.startDate.getTime();
  const endMs = period.endDate.getTime();

  // 1. Strictly filter activities whose ISO timestamps fall inside [period.startDate, period.endDate]
  const periodActivities = activityItems.filter((item) => {
    try {
      const itemTime = new Date(item.createdAt).getTime();
      return itemTime >= startMs && itemTime <= endMs;
    } catch {
      return false;
    }
  });

  let progress = 0;
  let latestQualifyingDate: Date | null = null;

  switch (quest.metric) {
    case 'commits': {
      for (const act of periodActivities) {
        if (act.type === 'PushEvent') {
          progress += act.payload?.commitsCount || 1;
          const actDate = new Date(act.createdAt);
          if (!latestQualifyingDate || actDate > latestQualifyingDate) {
            latestQualifyingDate = actDate;
          }
        }
      }
      break;
    }

    case 'pull_requests': {
      for (const act of periodActivities) {
        if (act.type === 'PullRequestEvent') {
          progress += 1;
          const actDate = new Date(act.createdAt);
          if (!latestQualifyingDate || actDate > latestQualifyingDate) {
            latestQualifyingDate = actDate;
          }
        }
      }
      break;
    }

    case 'merged_pull_requests': {
      for (const act of periodActivities) {
        if (act.type === 'PullRequestEvent' && (act.payload?.action === 'closed' || act.payload?.isMerged)) {
          progress += 1;
          const actDate = new Date(act.createdAt);
          if (!latestQualifyingDate || actDate > latestQualifyingDate) {
            latestQualifyingDate = actDate;
          }
        }
      }
      break;
    }

    case 'issues': {
      for (const act of periodActivities) {
        if (act.type === 'IssuesEvent') {
          progress += 1;
          const actDate = new Date(act.createdAt);
          if (!latestQualifyingDate || actDate > latestQualifyingDate) {
            latestQualifyingDate = actDate;
          }
        }
      }
      break;
    }

    case 'active_days': {
      const activeDays = new Set<string>();
      for (const act of periodActivities) {
        const dayStr = new Date(act.createdAt).toISOString().split('T')[0];
        activeDays.add(dayStr);
        const actDate = new Date(act.createdAt);
        if (!latestQualifyingDate || actDate > latestQualifyingDate) {
          latestQualifyingDate = actDate;
        }
      }
      progress = activeDays.size;
      break;
    }

    case 'repositories': {
      for (const act of periodActivities) {
        if (act.type === 'CreateEvent' && act.payload?.refType === 'repository') {
          progress += 1;
          const actDate = new Date(act.createdAt);
          if (!latestQualifyingDate || actDate > latestQualifyingDate) {
            latestQualifyingDate = actDate;
          }
        }
      }
      break;
    }

    default:
      progress = 0;
  }

  const completed = progress >= quest.target;
  const completedAt = completed ? latestQualifyingDate || period.endDate : null;

  return {
    progress: Math.min(progress, quest.target),
    target: quest.target,
    completed,
    completedAt,
  };
}

/**
 * Authoritative XP composition: totalXP = githubXP + questXP
 */
export function calculateTotalLifetimeXp(githubXp: number, questXp: number): number {
  return Math.max(0, Math.floor(githubXp || 0)) + Math.max(0, Math.floor(questXp || 0));
}

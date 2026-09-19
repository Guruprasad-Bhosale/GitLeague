import { SCORING_RULES } from '@gitleague/config';

export interface ActivityEventInput {
  id: string;
  type: string;
  payload?: {
    action?: string;
    commitsCount?: number;
    isMerged?: boolean;
  };
}

export interface ActivityScoringResult {
  awardedXP: number;
  processedEventIds: string[];
  skippedDuplicateCount: number;
  breakdown: {
    commitsXP: number;
    prXP: number;
    mergedPrBonusXP: number;
    issuesXP: number;
    otherXP: number;
  };
}

/**
 * Deterministically scores a stream of GitHub activity events, preventing double-awarding through event ID deduplication.
 */
export function scoreActivityEvents(
  events: ActivityEventInput[] = [],
  alreadyProcessedIds: Set<string> | string[] = new Set(),
  config = SCORING_RULES
): ActivityScoringResult {
  const processedSet = alreadyProcessedIds instanceof Set ? alreadyProcessedIds : new Set(alreadyProcessedIds);
  const newProcessedIds: string[] = [];
  let skippedDuplicateCount = 0;

  let commitsXP = 0;
  let prXP = 0;
  let mergedPrBonusXP = 0;
  let issuesXP = 0;
  let otherXP = 0;

  for (const event of events) {
    if (!event.id || processedSet.has(event.id)) {
      skippedDuplicateCount++;
      continue;
    }

    newProcessedIds.push(event.id);
    processedSet.add(event.id);

    switch (event.type) {
      case 'PushEvent': {
        const count = Math.min(event.payload?.commitsCount ?? 1, 20); // capped at 20 commits per push event to prevent spam
        commitsXP += count * config.COMMIT_XP;
        break;
      }
      case 'PullRequestEvent': {
        if (event.payload?.action === 'opened') {
          prXP += config.PULL_REQUEST_XP;
        }
        if (event.payload?.isMerged || event.payload?.action === 'closed') {
          mergedPrBonusXP += config.MERGED_PULL_REQUEST_XP;
        }
        break;
      }
      case 'IssuesEvent': {
        if (event.payload?.action === 'opened') {
          issuesXP += config.ISSUE_XP;
        }
        break;
      }
      case 'CreateEvent': {
        otherXP += config.REPOSITORY_XP;
        break;
      }
      default:
        break;
    }
  }

  const awardedXP = commitsXP + prXP + mergedPrBonusXP + issuesXP + otherXP;

  return {
    awardedXP,
    processedEventIds: newProcessedIds,
    skippedDuplicateCount,
    breakdown: {
      commitsXP,
      prXP,
      mergedPrBonusXP,
      issuesXP,
      otherXP,
    },
  };
}

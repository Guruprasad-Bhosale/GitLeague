import { LeagueTier, IAchievementDefinition, IQuestDefinition, AchievementRarityLabel } from '@gitleague/types';

// ==========================================
// GitLeague Scoring Rules & Configuration
// ==========================================

export const SCORING_RULES = {
  COMMIT_XP: 10,
  PULL_REQUEST_XP: 40,
  MERGED_PULL_REQUEST_XP: 60,
  ISSUE_XP: 20,
  REPOSITORY_XP: 100,
  STAR_RECEIVED_XP: 5,
  CONTRIBUTION_DAY_XP: 10,
  DAILY_STREAK_BONUS_XP: 15,
  MAX_DAILY_COMMIT_XP_CAP: 250, // Anti-abuse cap for daily commit spam
} as const;

export const LEVEL_CONFIG = {
  XP_PER_LEVEL: 250,
} as const;

export const TIER_THRESHOLDS: Record<LeagueTier, { minLevel: number; minXp: number; title: string; color: string }> = {
  BRONZE: { minLevel: 1, minXp: 0, title: 'Novice Hacker', color: '#CD7F32' },
  SILVER: { minLevel: 5, minXp: 1250, title: 'Code Apprentice', color: '#C0C0C0' },
  GOLD: { minLevel: 10, minXp: 2500, title: 'Script Wizard', color: '#FFD700' },
  PLATINUM: { minLevel: 20, minXp: 5000, title: 'Cyber Knight', color: '#00FFFF' },
  DIAMOND: { minLevel: 35, minXp: 8750, title: 'Algorithm Lord', color: '#B9F2FF' },
  MASTER: { minLevel: 50, minXp: 12500, title: 'Matrix Architect', color: '#FF007F' },
  GRANDMASTER: { minLevel: 75, minXp: 18750, title: 'Git Sovereign', color: '#FF3300' },
};

// ==========================================
// Phase 9: Curated Deterministic Quest Catalog
// ==========================================

export const QUEST_CATALOG: IQuestDefinition[] = [
  // --- Daily Quests ---
  {
    id: 'daily_commit_starter',
    name: 'Commit Starter',
    description: 'Make at least 1 commit during today’s quest period.',
    type: 'daily',
    metric: 'commits',
    target: 1,
    rewardXP: 20,
    difficulty: 'easy',
  },
  {
    id: 'daily_code_sprint',
    name: 'Code Sprint',
    description: 'Make at least 5 commits during today’s quest period.',
    type: 'daily',
    metric: 'commits',
    target: 5,
    rewardXP: 60,
    difficulty: 'medium',
  },
  {
    id: 'daily_pr_initiator',
    name: 'PR Initiator',
    description: 'Open or author 1 pull request today.',
    type: 'daily',
    metric: 'pull_requests',
    target: 1,
    rewardXP: 50,
    difficulty: 'medium',
  },
  {
    id: 'daily_issue_triage',
    name: 'Issue Dispatcher',
    description: 'Open or document 1 GitHub issue today.',
    type: 'daily',
    metric: 'issues',
    target: 1,
    rewardXP: 30,
    difficulty: 'easy',
  },
  {
    id: 'daily_merge_touch',
    name: 'Shipping Touch',
    description: 'Land 1 merged pull request today.',
    type: 'daily',
    metric: 'merged_pull_requests',
    target: 1,
    rewardXP: 75,
    difficulty: 'hard',
  },

  // --- Weekly Quests ---
  {
    id: 'weekly_consistent_coder',
    name: 'Consistent Coder',
    description: 'Contribute on at least 3 distinct calendar days this week.',
    type: 'weekly',
    metric: 'active_days',
    target: 3,
    rewardXP: 150,
    difficulty: 'medium',
  },
  {
    id: 'weekly_shipping_week',
    name: 'Shipping Week',
    description: 'Push at least 15 commits across the week.',
    type: 'weekly',
    metric: 'commits',
    target: 15,
    rewardXP: 200,
    difficulty: 'medium',
  },
  {
    id: 'weekly_collaboration',
    name: 'Open Collaboration',
    description: 'Submit or author at least 3 pull requests this week.',
    type: 'weekly',
    metric: 'pull_requests',
    target: 3,
    rewardXP: 180,
    difficulty: 'hard',
  },
  {
    id: 'weekly_merge_champion',
    name: 'Merge Champion',
    description: 'Merge at least 2 pull requests into production code this week.',
    type: 'weekly',
    metric: 'merged_pull_requests',
    target: 2,
    rewardXP: 220,
    difficulty: 'hard',
  },
  {
    id: 'weekly_issue_hunter',
    name: 'Bug Hunter',
    description: 'Open or track at least 3 issues this week.',
    type: 'weekly',
    metric: 'issues',
    target: 3,
    rewardXP: 120,
    difficulty: 'easy',
  },
  {
    id: 'weekly_iron_coder',
    name: 'Iron Coder',
    description: 'Achieve contributions on at least 5 separate days this week.',
    type: 'weekly',
    metric: 'active_days',
    target: 5,
    rewardXP: 300,
    difficulty: 'hard',
  },
];

// ==========================================
// Phase 9: Expanded Achievement Catalog
// (Existing legacy IDs are strictly preserved)
// ==========================================

export const INITIAL_ACHIEVEMENTS: IAchievementDefinition[] = [
  // --- Streaks ---
  {
    id: 'streak_master_7',
    title: 'Streak Master I',
    description: 'Maintain an active GitHub contribution streak for 7 consecutive days.',
    category: 'streak',
    icon: '⚡',
    xpReward: 100,
    maxProgress: 7,
  },
  {
    id: 'streak_master_30', // Legacy ID preserved
    title: 'Streak Master II',
    description: 'Maintain an active GitHub contribution streak for 30 consecutive days.',
    category: 'streak',
    icon: '🔥',
    xpReward: 300,
    maxProgress: 30,
  },
  {
    id: 'streak_master_100',
    title: 'Streak Master III',
    description: 'Maintain an active GitHub contribution streak for 100 consecutive days.',
    category: 'streak',
    icon: '👑',
    xpReward: 1000,
    maxProgress: 100,
  },

  // --- Commits ---
  {
    id: 'commit_machine_100',
    title: 'Commit Machine I',
    description: 'Push over 100 lifetime commits to tracked repositories.',
    category: 'commits',
    icon: '🗡️',
    xpReward: 150,
    maxProgress: 100,
  },
  {
    id: 'commit_machine_500', // Legacy ID preserved
    title: 'Commit Machine II',
    description: 'Push over 500 lifetime commits to tracked repositories.',
    category: 'commits',
    icon: '⚔️',
    xpReward: 500,
    maxProgress: 500,
  },
  {
    id: 'commit_machine_1000',
    title: 'Commit Machine III',
    description: 'Push over 1,000 lifetime commits to tracked repositories.',
    category: 'commits',
    icon: '🛡️',
    xpReward: 1000,
    maxProgress: 1000,
  },

  // --- Repositories / Builder ---
  {
    id: 'builder_5',
    title: 'Master Builder I',
    description: 'Create and actively maintain 5 original repositories.',
    category: 'builder',
    icon: '🧱',
    xpReward: 200,
    maxProgress: 5,
  },
  {
    id: 'builder_10', // Legacy ID preserved
    title: 'Master Builder II',
    description: 'Create and actively maintain 10 original repositories.',
    category: 'builder',
    icon: '🏗️',
    xpReward: 400,
    maxProgress: 10,
  },
  {
    id: 'builder_25',
    title: 'Master Builder III',
    description: 'Create and actively maintain 25 original repositories.',
    category: 'builder',
    icon: '🏛️',
    xpReward: 800,
    maxProgress: 25,
  },

  // --- Open Source / Merged PRs ---
  {
    id: 'open_source_hero_5',
    title: 'Open Source Pioneer I',
    description: 'Submit 5 merged pull requests across public projects.',
    category: 'open_source',
    icon: '🌱',
    xpReward: 200,
    maxProgress: 5,
  },
  {
    id: 'open_source_hero', // Legacy ID preserved (25 merged PRs)
    title: 'Open Source Pioneer II',
    description: 'Submit 25 merged pull requests across public open-source projects.',
    category: 'open_source',
    icon: '🌎',
    xpReward: 600,
    maxProgress: 25,
  },
  {
    id: 'open_source_hero_50',
    title: 'Open Source Pioneer III',
    description: 'Submit 50 merged pull requests across public open-source projects.',
    category: 'open_source',
    icon: '🪐',
    xpReward: 1200,
    maxProgress: 50,
  },

  // --- Stars ---
  {
    id: 'star_collector_25',
    title: 'Star Collector I',
    description: 'Earn a total of 25 stars across your authored repositories.',
    category: 'stars',
    icon: '✨',
    xpReward: 150,
    maxProgress: 25,
  },
  {
    id: 'star_collector_100', // Legacy ID preserved
    title: 'Star Collector II',
    description: 'Earn a total of 100 stars across your authored repositories.',
    category: 'stars',
    icon: '⭐',
    xpReward: 500,
    maxProgress: 100,
  },
  {
    id: 'star_collector_500',
    title: 'Star Collector III',
    description: 'Earn a total of 500 stars across your authored repositories.',
    category: 'stars',
    icon: '🌟',
    xpReward: 1500,
    maxProgress: 500,
  },
];

// ==========================================
// Rarity & Rank Milestones Configuration
// ==========================================

export const RARITY_THRESHOLDS: Array<{ minPercent: number; label: AchievementRarityLabel; color: string }> = [
  { minPercent: 50, label: 'Common', color: '#94A3B8' },     // Slate
  { minPercent: 20, label: 'Uncommon', color: '#22C55E' },   // Green
  { minPercent: 5, label: 'Rare', color: '#06B6D4' },        // Cyan
  { minPercent: 1, label: 'Epic', color: '#A855F7' },        // Purple
  { minPercent: 0, label: 'Legendary', color: '#F59E0B' },   // Amber/Gold
];

export const RANK_MILESTONES = [100, 50, 25, 10, 3, 1] as const;

export const APP_CONFIG = {
  NAME: 'GitLeague',
  VERSION: '1.0.0',
  DEFAULT_LEADERBOARD_PAGE_SIZE: 50,
  MAX_LEADERBOARD_PAGE_SIZE: 100,
  SYNC_COOLDOWN_MINUTES: 15,
} as const;


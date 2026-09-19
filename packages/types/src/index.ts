// ==========================================
// GitLeague Core Type Definitions
// ==========================================

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'MASTER' | 'GRANDMASTER';

export type SyncStatus = 'never_synced' | 'queued' | 'syncing' | 'completed' | 'failed';

export type LeaderboardScope = 'global' | 'country' | 'region' | 'college' | 'friends';

export interface IUser {
  _id: string;
  githubId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  githubProfileUrl: string;
  email?: string | null;
  bio?: string | null;
  location?: string | null;
  company?: string | null;
  collegeId?: string | null;
  encryptedAccessToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  lastSyncedAt?: Date | null;
  syncStatus?: SyncStatus;
  syncStartedAt?: Date | null;
  syncCompletedAt?: Date | null;
  syncError?: string | null;
}

export interface ISafeUser {
  id: string;
  githubId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  githubProfileUrl: string;
  email?: string | null;
  bio?: string | null;
  location?: string | null;
  company?: string | null;
  collegeId?: string | null;
  college?: ICollegeSummary | null;
  createdAt: Date | string;
  lastLoginAt: Date | string;
  lastSyncedAt?: Date | string | null;
  syncStatus?: SyncStatus;
  syncStartedAt?: Date | string | null;
  syncCompletedAt?: Date | string | null;
  syncError?: string | null;
}

export interface ISession {
  _id: string;
  sessionHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IAuthenticatedUser extends ISafeUser {
  sessionExpiresAt: Date | string;
}

export interface ILanguageStats {
  [language: string]: number; // Bytes of code or repository count
}

export interface IContributionDay {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface IGitHubStats {
  _id?: string;
  userId: string;
  commits: number;
  pullRequests: number;
  mergedPullRequests: number;
  issues: number;
  repositories: number;
  stars: number;
  followers: number;
  contributionDays: number;
  currentStreak: number;
  longestStreak: number;
  languages: ILanguageStats;
  activityHistory: IContributionDay[];
  lastSyncedAt: Date;
}

export interface IAchievementProgress {
  id: string;
  unlockedAt: Date;
  progress: number;
  isUnlocked: boolean;
}

export interface IRpgStats {
  coding: number;
  consistency: number;
  builder: number;
  openSource: number;
}

export interface IGameProfile {
  _id?: string;
  userId: string;
  xp: number;
  githubXP?: number;
  questXP?: number;
  level: number;
  tier: LeagueTier;
  currentRank: number;
  previousRank: number;
  seasonXP: number;
  stats: IRpgStats;
  achievements: IAchievementProgress[];
  updatedAt: Date;
}

export interface IXpBreakdown {
  commitsXP: number;
  pullRequestsXP: number;
  mergedPullRequestsXP: number;
  issuesXP: number;
  repositoriesXP: number;
  starsXP: number;
  contributionDaysXP: number;
  streakBonusXP: number;
  totalXP: number;
}

export interface ILevelProgress {
  currentLevel: number;
  currentLevelBaseXP: number;
  nextLevelXP: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  progressPercentage: number;
}

export interface ITierProgress {
  currentTier: LeagueTier;
  nextTier: LeagueTier | null;
  currentTierMinXP: number;
  nextTierMinXP: number | null;
  xpToNextTier: number;
  tierProgressPercentage: number;
  title: string;
  color: string;
}

export interface IStreakResult {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
}

export interface ICalculatedGameProfile {
  xp: number;
  level: number;
  tier: LeagueTier;
  levelProgress: ILevelProgress;
  tierProgress: ITierProgress;
  stats: IRpgStats;
  streak: IStreakResult;
  achievements: IAchievementProgress[];
  xpBreakdown: IXpBreakdown;
}

export interface IAchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: 'streak' | 'commits' | 'builder' | 'open_source' | 'stars';
  icon: string;
  xpReward: number;
  maxProgress: number;
}

export type SeasonStatus = 'upcoming' | 'active' | 'completed';

export interface ISeason {
  _id: string;
  seasonNumber: number;
  name: string;
  slug: string;
  startDate: Date | string;
  endDate: Date | string;
  status: SeasonStatus;
  isActive: boolean;
  isArchived: boolean;
  participantsCount: number;
}

export interface ISeasonParticipant {
  _id?: string;
  seasonId: string;
  userId: string;
  lifetimeXPAtSeasonStart: number;
  lifetimeXPAtLastSync: number;
  seasonXP: number;
  finalRank?: number | null;
  joinedAt: Date | string;
  updatedAt: Date | string;
}

export interface ISeasonSummary {
  id: string;
  seasonNumber: number;
  name: string;
  slug: string;
  status: SeasonStatus;
  startDate: Date | string;
  endDate: Date | string;
  participantsCount: number;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface IFriendship {
  _id: string;
  requesterId: string;
  recipientId: string;
  status: FriendshipStatus;
  pairA: string;
  pairB: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  acceptedAt?: Date | string | null;
}

export interface IFriendRequest {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterDisplayName: string | null;
  requesterAvatarUrl: string;
  requesterLevel: number;
  requesterTier: LeagueTier;
  createdAt: Date | string;
}

export interface IFriendSummary {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  level: number;
  tier: LeagueTier;
  xp: number;
  globalRank: number;
  friendshipId: string;
  friendsSince: Date | string;
}

export interface ICollege {
  _id: string;
  name: string;
  shortName?: string | null;
  slug: string;
  city: string;
  state: string;
  country: string;
  verified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ICollegeSummary {
  id: string;
  name: string;
  shortName?: string | null;
  slug: string;
  city?: string;
  state?: string;
  country?: string;
  verified: boolean;
}

export interface IUserSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  level: number;
  tier: LeagueTier;
  xp: number;
  college?: ICollegeSummary | null;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self';
  friendRequestId?: string;
}

export interface ICompareUserStat {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  level: number;
  tier: LeagueTier;
  xp: number;
  globalRank: number;
  countryRank?: number | null;
  collegeRank?: number | null;
  college?: ICollegeSummary | null;
  stats: IRpgStats;
  currentStreak: number;
  longestStreak: number;
  commits: number;
  pullRequests: number;
  issues: number;
  repositories: number;
  stars: number;
  achievementsCount: number;
}

export interface ICompareResponse {
  userA: ICompareUserStat;
  userB: ICompareUserStat;
}

export interface IUserProfile {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  githubProfileUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  college?: ICollegeSummary | null;
  friendsCount: number;
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self';
  level: number;
  xp: number;
  tier: LeagueTier;
  tierTitle: string;
  tierProgress: ITierProgress;
  levelProgress: ILevelProgress;
  globalRank: number;
  countryRank?: number | null;
  percentile: number;
  currentStreak: number;
  longestStreak: number;
  commits: number;
  pullRequests: number;
  mergedPullRequests: number;
  issues: number;
  repositories: number;
  stars: number;
  followers: number;
  languages: ILanguageStats;
  stats: IRpgStats;
  achievements: IAchievementWithRarity[];
  rankMovement?: IRankMovement | null;
  recentProgression?: IProgressionEvent[];
  seasonHistory?: IUserSeasonHistoryItem[];
  personalBests?: ISeasonPersonalBests;
  lastSyncedAt: Date | string | null;
}

export interface ILeaderboardEntry {
  rank: number;
  rankMovement: number; // positive for moving up, negative for down, 0 for same
  rankDirection?: RankDirection;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  level: number;
  tier: LeagueTier;
  xp: number;
  seasonXP: number;
  commits: number;
  pullRequests: number;
  currentStreak: number;
}

export interface IPaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    scopeNote?: string;
  };
}

export interface IPersonalRankResponse {
  currentRank: number;
  previousRank: number;
  rankMovement: number;
  rankDirection?: RankDirection;
  totalParticipants: number;
  percentile: number; // e.g., 94.2 (ahead of 94.2% of participants)
  xp: number;
  seasonXP: number;
  level: number;
  tier: LeagueTier;
}

export interface ISyncStatusResponse {
  userId: string;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | string | null;
  syncStartedAt: Date | string | null;
  syncCompletedAt: Date | string | null;
  syncError: string | null;
}

export interface ILeaderboardQuery {
  scope?: LeaderboardScope;
  country?: string;
  season?: string;
  page?: number;
  limit?: number;
  tier?: LeagueTier;
  search?: string;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type QuestType = 'daily' | 'weekly';

export type QuestMetric =
  | 'commits'
  | 'pull_requests'
  | 'merged_pull_requests'
  | 'issues'
  | 'active_days'
  | 'repositories';

export interface IQuestActivityItem {
  id?: string;
  type: string;
  createdAt: string | Date;
  payload?: {
    action?: string;
    commitsCount?: number;
    refType?: string;
    isMerged?: boolean;
    [key: string]: unknown;
  };
}

export interface IQuestDefinition {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  metric: QuestMetric;
  target: number;
  rewardXP: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface IQuestProgress {
  userId: string;
  questId: string;
  questType: QuestType;
  periodKey: string;
  progress: number;
  target: number;
  completed: boolean;
  completedAt?: Date | string | null;
  rewardXP: number;
  rewardGranted: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IQuestStatusSummary {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  metric: QuestMetric;
  target: number;
  rewardXP: number;
  progress: number;
  completed: boolean;
  completedAt?: Date | string | null;
  rewardGranted: boolean;
  periodKey: string;
}

export interface IUserQuestsResponse {
  daily: IQuestStatusSummary[];
  weekly: IQuestStatusSummary[];
  lastSyncedAt?: Date | string | null;
}

export type LeaderboardType = 'lifetime' | 'season';

export type RankDirection = 'up' | 'down' | 'same' | 'new';

export interface IRankMovement {
  previousRank: number | null;
  currentRank: number;
  movement: number;
  direction: RankDirection;
}

export interface IRankSnapshot {
  userId: string;
  leaderboardType: LeaderboardType;
  scope: string;
  seasonId?: string | null;
  rank: number;
  xp: number;
  capturedAt: Date | string;
  periodKey: string;
}

export type AchievementRarityLabel = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface IAchievementWithRarity {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  xpReward: number;
  maxProgress: number;
  progress: number;
  progressPercentage: number;
  isUnlocked: boolean;
  unlockedAt: Date | string;
  rarityPercent: number;
  rarityLabel: AchievementRarityLabel;
}

export type ProgressionEventType =
  | 'LEVEL_UP'
  | 'TIER_UP'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'QUEST_COMPLETED'
  | 'RANK_MILESTONE'
  | 'SEASON_STARTED'
  | 'SEASON_COMPLETED'
  | 'SEASON_PERSONAL_BEST';

export interface IProgressionEvent {
  id?: string;
  userId: string;
  type: ProgressionEventType;
  eventKey: string;
  metadata: Record<string, unknown>;
  occurredAt: Date | string;
}

export interface ISeasonResult {
  _id?: string;
  seasonId: string;
  userId: string;
  finalRank: number;
  finalXP: number;
  finalLevel: number;
  finalTier: LeagueTier;
  country?: string | null;
  collegeId?: string | null;
  finalizedAt: Date | string;
}

export interface IUserSeasonHistoryItem {
  season: {
    id: string;
    seasonNumber: number;
    name: string;
    slug: string;
    status: SeasonStatus;
    startDate: Date | string;
    endDate: Date | string;
  };
  finalRank: number;
  finalXP: number;
  finalLevel: number;
  finalTier: LeagueTier;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}

export interface ISeasonPersonalBests {
  bestRank?: { seasonSlug: string; seasonName: string; rank: number } | null;
  bestXP?: { seasonSlug: string; seasonName: string; xp: number } | null;
  seasonsParticipated: number;
}

export interface IRankHistorySnapshot {
  periodKey: string;
  rank: number;
  xp: number;
  capturedAt: Date | string;
}

export interface IRankHistoryResponse {
  userId: string;
  username: string;
  leaderboardType: LeaderboardType;
  scope: string;
  seasonSlug?: string | null;
  snapshots: IRankHistorySnapshot[];
}



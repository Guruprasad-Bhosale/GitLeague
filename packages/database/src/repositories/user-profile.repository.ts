import { UserModel } from '../models/user.model.js';
import { GameProfileModel } from '../models/game-profile.model.js';
import { GithubStatsModel } from '../models/github-stats.model.js';
import { CollegeModel } from '../models/college.model.js';
import { FriendshipRepository } from './friendship.repository.js';
import { ProgressionEventRepository } from './progression-event.repository.js';
import { RankSnapshotRepository } from './rank-snapshot.repository.js';
import { GameProfileRepository } from './game-profile.repository.js';
import { SeasonResultRepository } from './season-result.repository.js';
import { IUserProfile, ICollegeSummary, IAchievementWithRarity } from '@gitleague/types';
import {
  getLevelProgress,
  getTierProgress,
  calculateRarity,
  calculateRankMovement,
  getDailyQuestPeriod,
  calculateSeasonPersonalBests,
} from '@gitleague/game-engine';
import { TIER_THRESHOLDS, INITIAL_ACHIEVEMENTS } from '@gitleague/config';

export class UserProfileRepository {
  /**
   * Resolve public GitLeague developer profile with ranking, tier progression, RPG attributes, achievements with rarity, rank movement, recent progression timeline, season history, personal bests, college, and social stats
   */
  static async getPublicProfileByUsername(
    username: string,
    currentAuthUserId?: string
  ): Promise<IUserProfile | null> {
    const user = await UserModel.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return null;
    }

    const userId = user._id.toString();
    const currentPeriodKey = getDailyQuestPeriod().periodKey;

    // Query game profile, github stats, college, social, events, snapshot, and season history in parallel
    const [
      gameProfile,
      statsDoc,
      collegeDoc,
      friendsCount,
      friendshipInfo,
      recentProgression,
      prevSnapshotRank,
      achievementDist,
      seasonHistory,
    ] = await Promise.all([
      GameProfileModel.findOne({
        $or: [{ userId }, { userId: user.githubId }],
      }),
      GithubStatsModel.findOne({
        $or: [{ userId }, { userId: user.githubId }],
      }),
      user.collegeId ? CollegeModel.findById(user.collegeId).lean() : Promise.resolve(null),
      FriendshipRepository.countFriends(userId),
      currentAuthUserId
        ? FriendshipRepository.getFriendshipStatus(currentAuthUserId, userId)
        : Promise.resolve({ status: 'none' as const }),
      ProgressionEventRepository.getRecentEvents(userId, 10),
      RankSnapshotRepository.getSinglePreviousSnapshot(userId, 'lifetime', 'global', currentPeriodKey),
      GameProfileRepository.getAchievementDistribution(),
      SeasonResultRepository.getUserSeasonHistory(userId),
    ]);

    // If user has no GameProfile, they haven't joined/synced GitLeague
    if (!gameProfile) {
      return null;
    }


    const xp = gameProfile.xp || 0;
    const level = gameProfile.level || 1;
    const tier = gameProfile.tier || 'BRONZE';
    const tierConfig = TIER_THRESHOLDS[tier] || { title: tier, color: '#CD7F32' };

    // Calculate level and tier progress
    const levelProgress = getLevelProgress(xp);
    const tierProgress = getTierProgress(xp, level);

    // Compute global ranking and percentile
    const totalParticipants = await GameProfileModel.countDocuments();
    const higherRankCount = await GameProfileModel.countDocuments({
      $or: [
        { xp: { $gt: xp } },
        { xp, level: { $gt: level } },
        { xp, level, userId: { $lt: gameProfile.userId } },
      ],
    });

    const globalRank = higherRankCount + 1;
    const percentile =
      totalParticipants > 1
        ? Number((((totalParticipants - globalRank) / totalParticipants) * 100).toFixed(1))
        : 100.0;

    // Compute rank movement from historical snapshot
    const rankMovement = calculateRankMovement(prevSnapshotRank, globalRank);

    // Compute country rank if applicable (e.g. India)
    let countryRank: number | null = null;
    if (user.location && /india/i.test(user.location)) {
      const matchedUsers = await UserModel.find(
        { location: { $regex: 'india', $options: 'i' } },
        { _id: 1 }
      ).lean();
      const countryUserIds = matchedUsers.map((u) => u._id.toString());

      const higherInCountry = await GameProfileModel.countDocuments({
        userId: { $in: countryUserIds },
        $or: [
          { xp: { $gt: xp } },
          { xp, level: { $gt: level } },
          { xp, level, userId: { $lt: gameProfile.userId } },
        ],
      });
      countryRank = higherInCountry + 1;
    }

    // Extract languages safely
    const languages: Record<string, number> = {};
    if (statsDoc?.languages) {
      if (statsDoc.languages instanceof Map) {
        statsDoc.languages.forEach((val, key) => {
          languages[key] = val;
        });
      } else {
        Object.assign(languages, statsDoc.languages);
      }
    }

    let collegeSummary: ICollegeSummary | null = null;
    if (collegeDoc) {
      collegeSummary = {
        id: collegeDoc._id.toString(),
        name: collegeDoc.name,
        shortName: collegeDoc.shortName || null,
        slug: collegeDoc.slug,
        city: collegeDoc.city,
        state: collegeDoc.state,
        country: collegeDoc.country,
        verified: collegeDoc.verified,
      };
    }

    // Build achievements enriched with definitions and dynamic factual rarity
    const userAchMap = new Map((gameProfile.achievements || []).map((a) => [a.id, a]));
    const totalEligible = achievementDist.totalEligible || 1;

    const achievementsWithRarity: IAchievementWithRarity[] = INITIAL_ACHIEVEMENTS.map((def) => {
      const userAch = userAchMap.get(def.id);
      const isUnlocked = Boolean(userAch?.isUnlocked);
      const progress = userAch?.progress || 0;
      const progressPercentage = Math.min(100, Math.floor((progress / def.maxProgress) * 100));
      const unlockedCount = achievementDist.distribution[def.id] || 0;
      const rarity = calculateRarity(unlockedCount, totalEligible);

      return {
        id: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        icon: def.icon,
        xpReward: def.xpReward,
        maxProgress: def.maxProgress,
        progress,
        progressPercentage,
        isUnlocked,
        unlockedAt: userAch?.unlockedAt || new Date(0),
        rarityPercent: rarity.rarityPercent,
        rarityLabel: rarity.rarityLabel,
      };
    });

    return {
      userId,
      username: user.username,
      displayName: user.displayName ?? null,
      avatarUrl: user.avatarUrl,
      githubProfileUrl: user.githubProfileUrl,
      bio: user.bio ?? null,
      location: user.location ?? null,
      company: user.company ?? null,
      college: collegeSummary,
      friendsCount,
      friendshipStatus: friendshipInfo.status,
      level,
      xp,
      tier,
      tierTitle: tierConfig.title,
      tierProgress,
      levelProgress,
      globalRank,
      countryRank,
      percentile,
      currentStreak: statsDoc?.currentStreak ?? 0,
      longestStreak: statsDoc?.longestStreak ?? 0,
      commits: statsDoc?.commits ?? 0,
      pullRequests: statsDoc?.pullRequests ?? 0,
      mergedPullRequests: statsDoc?.mergedPullRequests ?? 0,
      issues: statsDoc?.issues ?? 0,
      repositories: statsDoc?.repositories ?? 0,
      stars: statsDoc?.stars ?? 0,
      followers: statsDoc?.followers ?? 0,
      languages,
      stats: gameProfile.stats || { coding: 10, consistency: 10, builder: 10, openSource: 10 },
      achievements: achievementsWithRarity,
      rankMovement,
      recentProgression,
      seasonHistory,
      personalBests: calculateSeasonPersonalBests(seasonHistory),
      lastSyncedAt: user.lastSyncedAt ?? null,
    };
  }
}



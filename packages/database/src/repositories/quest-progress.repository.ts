import mongoose from 'mongoose';
import { QuestProgressModel, IQuestProgressDocument } from '../models/quest-progress.model.js';
import { IQuestProgress, QuestType } from '@gitleague/types';

export class QuestProgressRepository {
  /**
   * Fetch user's quest progress documents for specific period keys
   */
  static async getUserQuestProgress(
    userId: string,
    periodKeys: string[]
  ): Promise<IQuestProgressDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    return QuestProgressModel.find({
      userId,
      periodKey: { $in: periodKeys },
    }).lean() as unknown as Promise<IQuestProgressDocument[]>;
  }

  /**
   * Idempotent upsert of quest progress
   */
  static async upsertProgress(data: {
    userId: string;
    questId: string;
    questType: QuestType;
    periodKey: string;
    progress: number;
    target: number;
    completed: boolean;
    completedAt?: Date | null;
    rewardXP: number;
  }): Promise<IQuestProgressDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    const existing = await QuestProgressModel.findOne({
      userId: data.userId,
      questId: data.questId,
      periodKey: data.periodKey,
    });

    if (existing) {
      existing.progress = data.progress;
      existing.target = data.target;
      if (!existing.completed && data.completed) {
        existing.completed = true;
        existing.completedAt = data.completedAt || new Date();
      }
      await existing.save();
      return existing;
    }

    return QuestProgressModel.create({
      userId: data.userId,
      questId: data.questId,
      questType: data.questType,
      periodKey: data.periodKey,
      progress: data.progress,
      target: data.target,
      completed: data.completed,
      completedAt: data.completed ? data.completedAt || new Date() : null,
      rewardXP: data.rewardXP,
      rewardGranted: false,
    });
  }

  /**
   * Atomically mark quest reward as granted
   */
  static async grantReward(
    userId: string,
    questId: string,
    periodKey: string
  ): Promise<boolean> {
    if (mongoose.connection.readyState === 0) return false;
    const res = await QuestProgressModel.updateOne(
      {
        userId,
        questId,
        periodKey,
        completed: true,
        rewardGranted: { $ne: true },
      },
      {
        $set: { rewardGranted: true },
      }
    );

    return res.modifiedCount > 0;
  }

  /**
   * Authoritative summation of all earned quest XP for a user
   */
  static async getTotalUserQuestXP(userId: string): Promise<number> {
    if (mongoose.connection.readyState === 0) return 0;
    const res = await QuestProgressModel.aggregate<{ totalQuestXP: number }>([
      {
        $match: {
          userId,
          completed: true,
          rewardGranted: true,
        },
      },
      {
        $group: {
          _id: null,
          totalQuestXP: { $sum: '$rewardXP' },
        },
      },
    ]);

    return res[0]?.totalQuestXP || 0;
  }
}

import { Request, Response, NextFunction } from 'express';
import { UserRepository, QuestProgressRepository } from '@gitleague/database';
import {
  getDailyQuestPeriod,
  getWeeklyQuestPeriod,
  getQuestsForPeriod,
} from '@gitleague/game-engine';
import {
  IQuestStatusSummary,
  IUserQuestsResponse,
} from '@gitleague/types';
import { AppError } from '../errors/app-error.js';

export class QuestController {
  /**
   * GET /api/v1/me/quests
   * Retrieve active daily and weekly quests, current user progress, and reward status
   */
  static async getMyQuests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user.id;
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      const dailyPeriod = getDailyQuestPeriod();
      const weeklyPeriod = getWeeklyQuestPeriod();

      const dailyDefs = getQuestsForPeriod('daily', dailyPeriod.periodKey);
      const weeklyDefs = getQuestsForPeriod('weekly', weeklyPeriod.periodKey);

      const [dailyProgressList, weeklyProgressList] = await Promise.all([
        QuestProgressRepository.getUserQuestProgress(userId, [dailyPeriod.periodKey]),
        QuestProgressRepository.getUserQuestProgress(userId, [weeklyPeriod.periodKey]),
      ]);

      const dailyMap = new Map(dailyProgressList.map((p) => [p.questId, p]));
      const weeklyMap = new Map(weeklyProgressList.map((p) => [p.questId, p]));

      const dailySummaries: IQuestStatusSummary[] = dailyDefs.map((def) => {
        const stored = dailyMap.get(def.id);
        const progress = stored?.progress ?? 0;
        const completed = stored?.completed ?? false;
        const rewardGranted = stored?.rewardGranted ?? false;
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          type: def.type,
          metric: def.metric,
          target: def.target,
          rewardXP: def.rewardXP,
          progress,
          completed,
          completedAt: stored?.completedAt ? new Date(stored.completedAt).toISOString() : null,
          rewardGranted,
          periodKey: dailyPeriod.periodKey,
        };
      });

      const weeklySummaries: IQuestStatusSummary[] = weeklyDefs.map((def) => {
        const stored = weeklyMap.get(def.id);
        const progress = stored?.progress ?? 0;
        const completed = stored?.completed ?? false;
        const rewardGranted = stored?.rewardGranted ?? false;
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          type: def.type,
          metric: def.metric,
          target: def.target,
          rewardXP: def.rewardXP,
          progress,
          completed,
          completedAt: stored?.completedAt ? new Date(stored.completedAt).toISOString() : null,
          rewardGranted,
          periodKey: weeklyPeriod.periodKey,
        };
      });

      const responseData: IUserQuestsResponse = {
        daily: dailySummaries,
        weekly: weeklySummaries,
        lastSyncedAt: user.lastSyncedAt ? user.lastSyncedAt.toISOString() : null,
      };

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }
}

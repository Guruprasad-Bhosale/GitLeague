import { Request, Response, NextFunction } from 'express';
import { TriggerSyncSchema } from '@gitleague/validation';
import { UserRepository } from '@gitleague/database';
import { QueueService } from '../services/queue.service.js';
import { AppError } from '../errors/app-error.js';

export class SyncController {
  /**
   * GET /api/v1/me/sync
   * Check status of GitHub synchronization for the authenticated user
   */
  static async getSyncStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const user = await UserRepository.findById(req.user.id);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      res.status(200).json({
        success: true,
        data: {
          userId: user._id.toString(),
          syncStatus: user.syncStatus || 'never_synced',
          lastSyncedAt: user.lastSyncedAt ?? null,
          syncStartedAt: user.syncStartedAt ?? null,
          syncCompletedAt: user.syncCompletedAt ?? null,
          syncError: user.syncError ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/me/sync
   * Trigger a background synchronization job for the authenticated user
   */
  static async triggerSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const validation = TriggerSyncSchema.safeParse(req.body || {});
      const force = validation.success ? validation.data.force : false;

      const result = await QueueService.enqueueUserSync(req.user.id, force);

      res.status(202).json({
        success: true,
        data: {
          jobId: result.jobId,
          syncStatus: result.status,
          message: result.queued
            ? 'Background synchronization job has been queued.'
            : 'Synchronization is already currently in progress.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { UserRepository } from '@gitleague/database';
import { logger } from '../lib/logger.js';

const SYNC_QUEUE_NAME = 'github-sync';
const JOB_USER_SYNC = 'github:user-sync';

let syncQueue: Queue | null = null;

function getSyncQueue(): Queue {
  if (!syncQueue) {
    syncQueue = new Queue(SYNC_QUEUE_NAME, {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });

    syncQueue.on('error', (err) => {
      logger.warn({ err: err.message }, 'Sync Queue error encountered');
    });
  }
  return syncQueue;
}

export class QueueService {
  /**
   * Enqueue a background sync job for a specific user
   */
  static async enqueueUserSync(
    userId: string,
    force = false
  ): Promise<{ jobId: string; status: string; queued: boolean }> {
    try {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if already syncing or recently synced (unless force is true)
      if (!force && user.syncStatus === 'syncing') {
        return {
          jobId: `active-sync-${userId}`,
          status: 'syncing',
          queued: false,
        };
      }

      const queue = getSyncQueue();
      const job = await queue.add(
        JOB_USER_SYNC,
        { userId, force },
        {
          jobId: `user-sync:${userId}`,
        }
      );

      // Mark user status as queued in database
      await UserRepository.updateSyncStatus(userId, 'queued', { error: null });

      logger.info({ userId, jobId: job.id }, 'GitHub sync job successfully enqueued');

      return {
        jobId: job.id || '',
        status: 'queued',
        queued: true,
      };
    } catch (err) {
      logger.error({ err, userId }, 'Failed to enqueue GitHub sync job');
      // If Redis queue fails, do not crash the API
      return {
        jobId: '',
        status: 'failed_to_queue',
        queued: false,
      };
    }
  }
}

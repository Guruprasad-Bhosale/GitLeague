import pino from 'pino';
import { connectDatabase, disconnectDatabase } from '@gitleague/database';
import { createSyncWorker } from './worker.js';
import { processSeasonLifecycle } from './processors/season-lifecycle.processor.js';
import { workerEnv } from './config/env.js';

const logger = pino({
  level: workerEnv.LOG_LEVEL || 'info',
  transport:
    workerEnv.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

let isShuttingDown = false;
let lifecycleInterval: NodeJS.Timeout | null = null;

export async function startWorker() {
  logger.info('⚡ Starting GitLeague Sync Worker...');
  logger.info(`Environment: ${workerEnv.NODE_ENV}`);
  logger.info(`Worker Concurrency: ${workerEnv.WORKER_CONCURRENCY}`);

  try {
    await connectDatabase(workerEnv.MONGODB_URI);
    logger.info('📦 Connected to MongoDB for Worker process');
  } catch (err) {
    logger.fatal({ err }, '❌ Failed to connect to MongoDB in Worker process');
    process.exit(1);
  }

  const worker = createSyncWorker();

  // Run initial season lifecycle check on startup
  processSeasonLifecycle().catch((err) => {
    logger.error({ err }, 'Error during initial season lifecycle check');
  });

  // Schedule periodic season lifecycle checks (every 60s)
  lifecycleInterval = setInterval(() => {
    processSeasonLifecycle().catch((err) => {
      logger.error({ err }, 'Error during scheduled season lifecycle check');
    });
  }, 60000);

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`Shutdown already in progress, ignoring duplicate signal: ${signal}`);
      return;
    }
    isShuttingDown = true;
    logger.info(`🛑 Received ${signal}, closing worker gracefully...`);

    if (lifecycleInterval) {
      clearInterval(lifecycleInterval);
      lifecycleInterval = null;
    }

    const shutdownTimeout = setTimeout(() => {
      logger.error('⏰ Worker graceful shutdown timed out (10s). Forcing exit.');
      process.exit(1);
    }, 10000);
    shutdownTimeout.unref();

    try {
      // 1. Close BullMQ worker (allows current in-flight job to finish or pause)
      await worker.close();
      logger.info('🔌 BullMQ worker closed');

      // 2. Disconnect database
      await disconnectDatabase();
      logger.info('📦 Database disconnected cleanly');

      clearTimeout(shutdownTimeout);
      logger.info('✅ Worker shutdown complete');
      process.exit(0);
    } catch (err) {

      logger.error({ err }, '❌ Error during graceful shutdown');
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, '💥 Uncaught Exception detected in Worker');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, '💥 Unhandled Promise Rejection detected in Worker');
    shutdown('unhandledRejection');
  });

  return worker;
}

// Automatically start if run directly
if (workerEnv.NODE_ENV !== 'test') {
  startWorker().catch((err) => {
    logger.fatal(err, 'Failed to start GitLeague worker');
    process.exit(1);
  });
}


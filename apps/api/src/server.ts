import { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { CacheService } from './lib/redis.js';
import { connectDatabase, disconnectDatabase } from '@gitleague/database';

let server: Server | null = null;
let isShuttingDown = false;

export async function startServer(): Promise<Server> {
  try {
    logger.info('⚡ Starting GitLeague API server...');
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Configured Port: ${env.PORT}`);

    // Connect to MongoDB
    try {
      await connectDatabase(env.MONGODB_URI);
      logger.info('📦 MongoDB connection established successfully');
    } catch (dbErr) {
      logger.error({ err: dbErr }, '❌ Failed to connect to MongoDB');
      // In production, database is required for API operation
      if (env.NODE_ENV === 'production') {
        throw dbErr;
      } else {
        logger.warn('⚠️ Starting in degraded mode without database connection (development/test)');
      }
    }

    const app = createApp();

    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`🚀 GitLeague API ready and listening on http://${env.HOST}:${env.PORT}`);
      logger.info(`Health check available at http://${env.HOST}:${env.PORT}/api/v1/health`);
    });

    return server;
  } catch (err) {
    logger.fatal({ err }, '💥 Fatal error during server startup');
    process.exit(1);
  }
}

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring duplicate signal: ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('⏰ Graceful shutdown timed out (10s). Forcing termination.');
    process.exit(1);
  }, 10000);

  // Unref timeout so it doesn't hold the process open if cleanup finishes
  shutdownTimeout.unref();

  try {
    // 1. Stop accepting new HTTP requests
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => {
          if (err) return reject(err);
          logger.info('🔌 HTTP server stopped accepting connections');
          resolve();
        });
      });
    }

    // 2. Disconnect Redis Cache
    await CacheService.disconnect();
    logger.info('📦 Redis Cache disconnected cleanly');

    // 3. Disconnect from database
    await disconnectDatabase();
    logger.info('📦 Database disconnected cleanly');

    clearTimeout(shutdownTimeout);
    logger.info('✅ Graceful shutdown completed cleanly');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, '❌ Error occurred during graceful shutdown');
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Attach Process Signal Listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '💥 Uncaught Exception detected');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, '💥 Unhandled Promise Rejection detected');
  gracefulShutdown('unhandledRejection');
});

// If executed directly, run startServer
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.fatal(err, 'Failed to initialize server');
    process.exit(1);
  });
}

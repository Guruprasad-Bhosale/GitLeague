import dotenv from 'dotenv';
import pino from 'pino';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import { SeasonRepository } from '../repositories/season.repository.js';
import { UserModel } from '../models/user.model.js';
import { GameProfileModel } from '../models/game-profile.model.js';
import { GithubStatsModel } from '../models/github-stats.model.js';
import { SeasonModel } from '../models/season.model.js';
import { SeasonParticipantModel } from '../models/season-participant.model.js';
import { FriendshipModel } from '../models/friendship.model.js';
import { CollegeModel } from '../models/college.model.js';
import { QuestProgressModel } from '../models/quest-progress.model.js';
import { RankSnapshotModel } from '../models/rank-snapshot.model.js';
import { ProgressionEventModel } from '../models/progression-event.model.js';
import { SeasonResultModel } from '../models/season-result.model.js';

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export async function seedProductionDatabase(
  mongoUri?: string,
  options?: { skipConnect?: boolean }
): Promise<void> {
  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/gitleague';
  logger.info('🌱 Starting Production Database Bootstrap...');

  if (!options?.skipConnect) {
    await connectDatabase(uri);
    logger.info('📦 MongoDB connection established');
  }

  try {
    // 1. Sync & ensure all collection indexes
    logger.info('🔍 Ensuring and syncing database indexes...');
    await Promise.all([
      UserModel.syncIndexes(),
      GameProfileModel.syncIndexes(),
      GithubStatsModel.syncIndexes(),
      SeasonModel.syncIndexes(),
      SeasonParticipantModel.syncIndexes(),
      SeasonResultModel.syncIndexes(),
      FriendshipModel.syncIndexes(),
      CollegeModel.syncIndexes(),
      QuestProgressModel.syncIndexes(),
      RankSnapshotModel.syncIndexes(),
      ProgressionEventModel.syncIndexes(),
    ]);
    logger.info('✅ All collection indexes synced successfully');


    // 2. Ensure an active inaugural Season exists
    const activeSeason = await SeasonRepository.findActiveSeason();
    if (activeSeason) {
      logger.info(
        { seasonNumber: activeSeason.seasonNumber, name: activeSeason.name, slug: activeSeason.slug },
        'Active season already exists in database, skipping season initialization'
      );
    } else {
      const now = new Date();
      const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0, 23, 59, 59));

      const season01 = await SeasonRepository.createSeason({
        seasonNumber: 1,
        name: 'Season 01: Genesis',
        slug: 'season-01',
        startDate,
        endDate,
        status: 'active',
      });

      logger.info(
        { seasonNumber: season01.seasonNumber, name: season01.name, slug: season01.slug, startDate, endDate },
        '🌟 Inaugural active Season 01 created successfully'
      );
    }

    logger.info('🚀 Production bootstrap completed successfully');
  } catch (err) {
    logger.error({ err }, '❌ Error during production bootstrap');
    throw err;
  } finally {
    if (!options?.skipConnect) {
      await disconnectDatabase();
      logger.info('📦 MongoDB disconnected cleanly');
    }
  }
}

// Automatically run only if invoked directly from CLI
const isDirectExecution = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('seed-production.ts') || process.argv[1].endsWith('seed-production.js'))
);

if (isDirectExecution) {
  seedProductionDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

import { Router, type IRouter } from 'express';
import healthRoutes from './v1/health.routes.js';
import githubRoutes from './v1/github.routes.js';
import authRoutes from './v1/auth.routes.js';
import leaderboardRoutes from './v1/leaderboard.routes.js';
import meRoutes from './v1/me.routes.js';
import userRoutes from './v1/user.routes.js';
import seasonRoutes from './v1/season.routes.js';
import friendRoutes from './v1/friend.routes.js';
import collegeRoutes from './v1/college.routes.js';
import ogRoutes from './v1/og.routes.js';

const router: IRouter = Router();

// Mount API v1 routes
router.use('/v1', healthRoutes);
router.use('/v1/auth', authRoutes);
router.use('/v1/github', githubRoutes);
router.use('/v1/leaderboard', leaderboardRoutes);
router.use('/v1/me', meRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/seasons', seasonRoutes);
router.use('/v1/friends', friendRoutes);
router.use('/v1/colleges', collegeRoutes);
router.use('/v1/og', ogRoutes);

export default router;


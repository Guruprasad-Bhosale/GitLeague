import { Router, type IRouter } from 'express';
import { LeaderboardController } from '../../controllers/leaderboard.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

const router: IRouter = Router();

// Public / Semi-Authenticated: GET /api/v1/leaderboard
router.get('/', optionalAuth, LeaderboardController.getLeaderboard);

// Authenticated: GET /api/v1/leaderboard/me
router.get('/me', requireAuth, LeaderboardController.getMyRank);

export default router;

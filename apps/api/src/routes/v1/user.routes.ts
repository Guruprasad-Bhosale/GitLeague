import { Router, type IRouter } from 'express';
import { UserProfileController } from '../../controllers/user-profile.controller.js';
import { UserSearchController } from '../../controllers/user-search.controller.js';
import { CompareController } from '../../controllers/compare.controller.js';
import { UserSeasonsController } from '../../controllers/user-seasons.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

const router: IRouter = Router();

// Participant search: GET /api/v1/users/search?q=...
router.get('/search', optionalAuth, UserSearchController.searchUsers);

// Side-by-side comparison: GET /api/v1/users/:username/compare
router.get('/:username/compare', requireAuth, CompareController.compareUsers);

// Public / Semi-Authenticated: GET /api/v1/users/:username/profile
router.get('/:username/profile', optionalAuth, UserProfileController.getPublicProfile);

// Historical season participation: GET /api/v1/users/:username/seasons
router.get('/:username/seasons', optionalAuth, UserSeasonsController.getUserSeasons);

// Real persisted rank history: GET /api/v1/users/:username/rank-history
router.get('/:username/rank-history', optionalAuth, UserSeasonsController.getUserRankHistory);

export default router;


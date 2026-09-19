import { Router, type IRouter } from 'express';
import { SyncController } from '../../controllers/sync.controller.js';
import { CollegeController } from '../../controllers/college.controller.js';
import { QuestController } from '../../controllers/quest.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router: IRouter = Router();

// All /me/* endpoints require active authentication
router.use(requireAuth);

// GET /api/v1/me/sync
router.get('/sync', SyncController.getSyncStatus);

// POST /api/v1/me/sync
router.post('/sync', SyncController.triggerSync);

// GET /api/v1/me/quests
router.get('/quests', QuestController.getMyQuests);

// PATCH /api/v1/me/college
router.patch('/college', CollegeController.setUserCollege);

export default router;

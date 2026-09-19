import { Router, type IRouter } from 'express';
import { SeasonController } from '../../controllers/season.controller.js';

const router: IRouter = Router();

// Public season routes
router.get('/', SeasonController.listSeasons);
router.get('/current', SeasonController.getCurrentSeason);
router.get('/:slug', SeasonController.getSeasonBySlug);

// Explicit season creation (admin/setup)
router.post('/', SeasonController.createSeason);

export default router;

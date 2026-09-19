import { Router, type IRouter } from 'express';
import { OgController } from '../../controllers/og.controller.js';

const router: IRouter = Router();

// GET /api/v1/og/profile/:username
router.get('/profile/:username', OgController.getProfileCard);

export default router;

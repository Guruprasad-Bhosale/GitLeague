import { Router, type IRouter } from 'express';
import { GitHubController } from '../../controllers/github.controller.js';

const router: IRouter = Router();

// GET /api/v1/github/users/:username
router.get('/users/:username', GitHubController.getUserByUsername);

export default router;

import { Router, type IRouter } from 'express';
import { AuthController } from '../../controllers/auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router: IRouter = Router();

// OAuth initiation
router.get('/github', AuthController.initiateGitHubLogin);

// OAuth callback
router.get('/github/callback', AuthController.handleGitHubCallback);

// Authenticated session context
router.get('/me', requireAuth, AuthController.getMe);

// Logout & session invalidation
router.post('/logout', AuthController.logout);

export default router;

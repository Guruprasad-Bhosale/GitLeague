import { Router, type IRouter } from 'express';
import { HealthController } from '../../controllers/health.controller.js';

const router: IRouter = Router();

router.get('/health', HealthController.getHealth);
router.get('/health/ready', HealthController.getReadiness);
router.get('/health/live', HealthController.getLiveness);

export default router;

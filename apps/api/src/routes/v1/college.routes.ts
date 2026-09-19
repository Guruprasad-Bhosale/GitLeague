import { Router, type IRouter } from 'express';
import { CollegeController } from '../../controllers/college.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router: IRouter = Router();

// Public directory search: GET /api/v1/colleges
router.get('/', CollegeController.searchColleges);

// Authenticated college update: PATCH /api/v1/colleges/me
router.patch('/me', requireAuth, CollegeController.setUserCollege);

export default router;

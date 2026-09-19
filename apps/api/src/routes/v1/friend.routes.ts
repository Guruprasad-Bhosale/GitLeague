import { Router, type IRouter } from 'express';
import { FriendController } from '../../controllers/friend.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router: IRouter = Router();

// All friend routes require active authentication
router.use(requireAuth);

// Friend requests
router.post('/requests', FriendController.sendRequest);
router.get('/requests', FriendController.getRequests);
router.post('/requests/:id/accept', FriendController.acceptRequest);
router.post('/requests/:id/reject', FriendController.rejectRequest);

// Remove friend
router.delete('/:userId', FriendController.removeFriend);

// Friends list
router.get('/', FriendController.getFriends);

export default router;

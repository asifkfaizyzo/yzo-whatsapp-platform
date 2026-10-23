import express from 'express';
import * as quickReplyController from './quickReplyController.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import uploadQuickReply from './uploadQuickReply.middleware.js';

const router = express.Router();

// Apply auth & subscription check on all quick reply endpoints
router.use(verifyTenantOrUser, checkSubscriptionAccess);

// 1. Static and custom endpoints FIRST (prevents clash with /:id)
router.get('/categories', quickReplyController.listCategories);
router.get('/by-shortcut/:shortcut', quickReplyController.getByShortcut);

// 2. Collection endpoints
router.get('/', quickReplyController.listQuickReplies);
router.post('/', uploadQuickReply.single('attachment'), quickReplyController.createQuickReply);

// 3. Parameterized /:id endpoints
router.get('/:id', quickReplyController.getQuickReply);
router.put('/:id', uploadQuickReply.single('attachment'), quickReplyController.updateQuickReply);
router.delete('/:id', quickReplyController.deleteQuickReply);

export default router;

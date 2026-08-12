import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import { getBroadcasts, getBroadcastStats, launchBroadcast, cancelBroadcast } from './broadcastController.js';

const router = express.Router();

// Viewing broadcasts list and stats is allowed for users (agents) and tenants
router.get('/', verifyTenantOrUser, checkSubscriptionAccess, getBroadcasts);
router.get('/:id/stats', verifyTenantOrUser, checkSubscriptionAccess, getBroadcastStats);

// RESTRICT launching and cancelling to Tenant Admins
router.post('/launch', verifyTenant, checkSubscriptionAccess, launchBroadcast);
router.post('/:id/cancel', verifyTenant, checkSubscriptionAccess, cancelBroadcast);

export default router;
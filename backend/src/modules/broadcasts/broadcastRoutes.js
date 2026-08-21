import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import {
  getBroadcasts,
  getBroadcastStats,
  getBroadcastRecipients,
  exportBroadcastRecipients,
  retryFailedBroadcast,
  pauseBroadcast,
  resumeBroadcast,
  launchBroadcast,
  cancelBroadcast
} from './broadcastController.js';

const router = express.Router();

// Viewing broadcasts list and stats/logs is allowed for users (agents) and tenants
router.get('/', verifyTenantOrUser, checkSubscriptionAccess, getBroadcasts);
router.get('/:id/stats', verifyTenantOrUser, checkSubscriptionAccess, getBroadcastStats);
router.get('/:id/recipients', verifyTenantOrUser, checkSubscriptionAccess, getBroadcastRecipients);
router.get('/:id/export', verifyTenantOrUser, checkSubscriptionAccess, exportBroadcastRecipients);

// Actions restricted to Tenant Admins
router.post('/launch', verifyTenant, checkSubscriptionAccess, launchBroadcast);
router.post('/:id/cancel', verifyTenant, checkSubscriptionAccess, cancelBroadcast);
router.post('/:id/pause', verifyTenant, checkSubscriptionAccess, pauseBroadcast);
router.post('/:id/resume', verifyTenant, checkSubscriptionAccess, resumeBroadcast);
router.post('/:id/retry-failed', verifyTenant, checkSubscriptionAccess, retryFailedBroadcast);

export default router;
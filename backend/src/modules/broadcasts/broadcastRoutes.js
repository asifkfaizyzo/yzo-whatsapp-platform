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
import { resolveWooCommerceSegment } from './wooBroadcastSegmentService.js';

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

// 🔒 TEST ROUTE: WooCommerce Smart Segmentation Tester
router.post('/test/woo-segment', verifyTenantOrUser, checkSubscriptionAccess, async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const result = await resolveWooCommerceSegment(tenantId, {
      segmentMinSpend: req.body.segmentMinSpend ?? null,
      segmentMinOrders: req.body.segmentMinOrders ?? null,
      segmentInactiveDays: req.body.segmentInactiveDays ?? null,
      segmentIncludeAllWoo: req.body.segmentIncludeAllWoo ?? false,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Error testing woo segment:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
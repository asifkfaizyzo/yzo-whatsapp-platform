// backend/src/modules/analytics/analytics.routes.js (do not remove this comment)

import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/auth.verifyTenantOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/subscription.access.js';
import {
  getOverview,
  getFunnel,
  getTraffic,
  getCampaigns,
  getAgents,
  getFilters,
  exportData
} from './analytics.controller.js';

const router = express.Router();

router.use(verifyTenantOrUser);
router.use(checkSubscriptionAccess);

router.get('/overview',  getOverview);
router.get('/funnel',    getFunnel);
router.get('/traffic',   getTraffic);
router.get('/campaigns', getCampaigns);
router.get('/agents',    getAgents);
router.get('/filters',   getFilters);
router.get('/export',    exportData);

export default router;

// backend/src/modules/analytics/analyticsRoutes.js

import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import {
  getOverview,
  getFunnel,
  getTraffic,
  getCampaigns,
  getAgents,
  getFilters,
  exportData
} from './analyticsController.js';

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

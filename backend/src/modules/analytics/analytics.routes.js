// backend/src/modules/analytics/analytics.routes.js (do not remove this comment)

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import {
  getOverview,
  getFunnel,
  getTraffic,
  getCampaigns,
  getAgents,
  getFilters,
  exportData,
} from "./analytics.controller.js";

const router = express.Router();

router.use(authenticate, requireTenantOrUser);
router.use(checkSubscriptionAccess);

router.get("/overview", getOverview);
router.get("/funnel", getFunnel);
router.get("/traffic", getTraffic);
router.get("/campaigns", getCampaigns);
router.get("/agents", getAgents);
router.get("/filters", getFilters);
router.get("/export", exportData);

export default router;

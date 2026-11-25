// backend/src/modules/superadmin/settings/sradmin.settings.policy.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import {
  getSubscriptionPolicy,
  updateSubscriptionPolicy,
} from "./sradmin.settings.policy.controller.js";

const router = express.Router();

router.get("/", authenticate, requireSRAdmin, getSubscriptionPolicy);
router.put("/", authenticate, requireSRAdmin, updateSubscriptionPolicy);

export default router;
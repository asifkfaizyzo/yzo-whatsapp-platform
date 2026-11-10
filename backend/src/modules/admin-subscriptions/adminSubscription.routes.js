// backend/src/modules/admin-subscriptions/adminSubscription.routes.js (do not remove this comment)
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";
import * as adminSubscriptionsController from "./adminSubscription.controller.js";
import rateLimit from "express-rate-limit";

const router = Router();

const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    message:
      "Too many admin requests. Please wait a minute before trying again.",
  },
});

router.get(
  "/",
  authenticate, requireSRAdmin,
  adminSubscriptionsController.getSubscriptions,
);
router.patch(
  "/:tenantId",
  authenticate, requireSRAdmin,
  adminSubscriptionsController.updateSubscription,
);
router.post(
  "/:tenantId/manual-activate",
  authenticate, requireSRAdmin,
  adminActionLimiter,
  adminSubscriptionsController.manualPlanActivation,
);

export default router;

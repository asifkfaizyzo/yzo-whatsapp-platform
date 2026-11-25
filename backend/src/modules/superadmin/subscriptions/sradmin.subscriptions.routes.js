// backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import * as controller from "./sradmin.subscriptions.controller.js";

const router = express.Router();

router.get("/", authenticate, requireSRAdmin, controller.listSubscriptions);
router.get("/:tenantId", authenticate, requireSRAdmin, controller.getSubscription);

router.post("/:tenantId/extend", authenticate, requireSRAdmin, controller.extendSubscription);
router.post("/:tenantId/extend-trial", authenticate, requireSRAdmin, controller.extendTrial);
router.post("/:tenantId/change-plan", authenticate, requireSRAdmin, controller.changePlan);
router.post("/:tenantId/manual-activate", authenticate, requireSRAdmin, controller.manualActivate);
router.post("/:tenantId/pause", authenticate, requireSRAdmin, controller.pauseSubscription);
router.post("/:tenantId/reactivate", authenticate, requireSRAdmin, controller.reactivateSubscription);
router.post("/:tenantId/expire", authenticate, requireSRAdmin, controller.expireSubscription);

router.put("/:tenantId/limits", authenticate, requireSRAdmin, controller.updateLimits);
router.put("/:tenantId/grace", authenticate, requireSRAdmin, controller.updateGrace);
router.put("/:tenantId/free-until", authenticate, requireSRAdmin, controller.updateFreeUntil);

router.post("/:tenantId/addons/grant", authenticate, requireSRAdmin, controller.grantAddOn);
router.post("/:tenantId/addons/:tenantAddOnId/revoke", authenticate, requireSRAdmin, controller.revokeAddOn);

export default router;

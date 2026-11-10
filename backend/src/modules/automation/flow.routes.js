// backend/src/modules/automation/flow.routes.js (do not remove this comment)

import express from "express";
import flowController from "./flow.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";

import flowMediaUpload from "../../config/upload.flowMedia.js";
import { uploadFlowMedia } from "./flowMedia.controller.js";
import { requireTenant } from "../../middleware/requireTenant.js";

const router = express.Router();

router.use(authenticate, requireTenantOrUser);
router.use(checkSubscriptionAccess);

router.get("/", flowController.getAllFlows);
router.get("/:id", flowController.getFlow);
router.post("/", flowController.createFlow);
router.put("/:id", flowController.saveFlow);
router.delete("/:id", flowController.deleteFlow);
router.patch("/:id/toggle", flowController.toggleFlow);
router.patch("/:id/set-default", flowController.setDefault);
router.patch("/:id/unset-default", flowController.unsetDefault);

// ── Keyword Routes ──
router.get("/keywords/all", flowController.getAllKeywords);
router.get("/:id/keywords", flowController.getKeywords);
router.post("/:id/keywords", flowController.addKeywords);
router.delete("/keywords/:keywordId", flowController.removeKeyword);

// Upload media for automation flow (image / video)
router.post(
  "/media/upload",
  authenticate, requireTenant,
  flowMediaUpload.single("file"),
  uploadFlowMedia,
);

export default router;

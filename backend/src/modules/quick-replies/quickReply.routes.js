// backend/src/modules/quick-replies/quickReply.routes.js (do not remove this comment)
import express from "express";
import * as quickReplyController from "./quickReply.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import uploadQuickReply from "./quickReply.upload.js";

const router = express.Router();

// Apply auth & subscription check on all quick reply endpoints
router.use(authenticate, requireTenantOrUser, checkSubscriptionAccess);

// 1. Static and custom endpoints FIRST (prevents clash with /:id)
router.get("/categories", quickReplyController.listCategories);
router.get("/by-shortcut/:shortcut", quickReplyController.getByShortcut);

// 2. Collection endpoints
router.get("/", quickReplyController.listQuickReplies);
router.post(
  "/",
  uploadQuickReply.single("attachment"),
  quickReplyController.createQuickReply,
);

// 3. Parameterized /:id endpoints
router.get("/:id", quickReplyController.getQuickReply);
router.put(
  "/:id",
  uploadQuickReply.single("attachment"),
  quickReplyController.updateQuickReply,
);
router.delete("/:id", quickReplyController.deleteQuickReply);

export default router;

// backend/src/modules/messages/message.routes.js (do not remove this comment)
import express from "express";
import * as messageController from "./message.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import upload from "../../middleware/upload.js";

const router = express.Router();

// ── Incoming Message (test/internal simulation) — PROTECTED
// Real incoming messages arrive via the authenticated Meta webhook (/api/webhook).
// This route is for internal testing only and must require authentication.
router.post('/incoming', authenticate, requireTenantOrUser, upload.single("file"), messageController.incomingMessageController);

//Send Message Tenant to contact
router.post(
  "/contacts/:contactId/messages",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  messageController.sendMessage,
);

//route for Tenant / Agent / → Contact
router.post(
  "/contacts/:contactId/messages/media",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  ...messageController.sendMediaMessage,
);
//Delete message by messageId
router.delete(
  "/:messageId",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  messageController.deleteMessageController,
);

// Send Template Message (Tenant / Agent → Contact)
router.post(
  "/contacts/:contactId/messages/template",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  messageController.sendTemplateMessage,
);

export default router;

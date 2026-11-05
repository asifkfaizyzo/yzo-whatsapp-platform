// backend/src/modules/messages/message.routes.js (do not remove this comment)
import express from "express";
import * as messageController from "./message.controller.js";
import { verifyUser } from "../../middlewares/auth.user.js";
import { verifyTenantOrUser } from "../../middlewares/auth.verifyTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middlewares/subscription.access.js";
import upload from "../../middlewares/upload.middleware.js";

const router = express.Router();

// ── Incoming Message (test/internal simulation) — PROTECTED
// Real incoming messages arrive via the authenticated Meta webhook (/api/webhook).
// This route is for internal testing only and must require authentication.
router.post('/incoming', verifyTenantOrUser, upload.single("file"), messageController.incomingMessageController);

//Send Message Tenant to contact
router.post(
  "/contacts/:contactId/messages",
  verifyTenantOrUser,
  checkSubscriptionAccess,
  messageController.sendMessage,
);

//route for Tenant / Agent / → Contact
router.post(
  "/contacts/:contactId/messages/media",
  verifyTenantOrUser,
  checkSubscriptionAccess,
  ...messageController.sendMediaMessage,
);
//Delete message by messageId
router.delete(
  "/:messageId",
  verifyTenantOrUser,
  checkSubscriptionAccess,
  messageController.deleteMessageController,
);

// Send Template Message (Tenant / Agent → Contact)
router.post(
  "/contacts/:contactId/messages/template",
  verifyTenantOrUser,
  checkSubscriptionAccess,
  messageController.sendTemplateMessage,
);

export default router;

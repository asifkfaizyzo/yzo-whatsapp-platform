// backend/src/modules/conversations/conversation.routes.js (do not remove this comment)
import express from "express";
import * as conversationController from "./conversation.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";

const router = express.Router();

router.post(
  "/create-conversation",
  authenticate, requireTenantOrUser,
  conversationController.createConversation,
);

router.get(
  "/conversation/:contactId",
  authenticate, requireTenantOrUser,
  conversationController.getConversationController,
);
//conversations assigned to the logged in user
router.get(
  "/assigned",
  authenticate, requireTenantOrUser,
  conversationController.getAssignedConversationsController,
);

router.get(
  "/getmessage/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.getMessagesController,
);

// Update conversation status
router.patch(
  "/status/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.updateConversationStatusController,
);

// ── New Routes ────────────────────────────────────────────
router.patch(
  "/archive/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.archiveConversationController,
);
router.patch(
  "/unarchive/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.unarchiveConversationController,
);
router.delete(
  "/delete/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.deleteConversationController,
);
router.get(
  "/archived",
  authenticate, requireTenantOrUser,
  conversationController.getArchivedConversationsController,
);
// ── Mark as Read ──────────────────────────────────────────
router.patch(
  "/mark-read/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.markConversationAsReadController,
);

// ── Bulk Reassign ──────────────────────────────────────────
router.patch(
  "/bulk-reassign",
  authenticate, requireTenantOrUser,
  conversationController.bulkReassignConversationsController,
);
// ── Media, Links & Docs ────────────────────────────────────
router.get(
  "/media/:conversationId",
  authenticate, requireTenantOrUser,
  conversationController.getConversationMediaController,
);

router.patch(
  "/pin/:id",
  authenticate, requireTenantOrUser,
  conversationController.togglePinController,
);

export default router;

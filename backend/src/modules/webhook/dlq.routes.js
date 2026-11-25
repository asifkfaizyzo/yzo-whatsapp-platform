// backend/src/modules/webhook/dlq.routes.js (do not remove this comment)
//Dead Letter Queue
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";
import {
  getFailedWebhooks,
  getDLQStats,
  getFailedWebhookDetail,
  retryFailedWebhook,
  retryAllFailedWebhooks,
  deleteFailedWebhook,
  clearAllFailedWebhooks,
} from "./dlq.controller.js";

const router = express.Router();

// 🔐 All routes require SuperAdmin auth
router.get("/stats", authenticate, requireSRAdmin, getDLQStats);
router.get("/", authenticate, requireSRAdmin, getFailedWebhooks);
router.get("/:id", authenticate, requireSRAdmin, getFailedWebhookDetail);
router.post("/:id/retry", authenticate, requireSRAdmin, retryFailedWebhook);
router.post("/retry-all", authenticate, requireSRAdmin, retryAllFailedWebhooks);
router.delete("/:id", authenticate, requireSRAdmin, deleteFailedWebhook);
router.delete("/", authenticate, requireSRAdmin, clearAllFailedWebhooks);

export default router;

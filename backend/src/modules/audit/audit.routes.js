// backend/src/modules/audit/audit.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";
import {
  getAuditLogs,
  getAuditLogStats,
  manualCleanup,
} from "./audit.controller.js";

const router = express.Router();

// 🔐 All routes — SuperAdmin only
router.get("/", authenticate, requireSRAdmin, getAuditLogs);
router.get("/stats", authenticate, requireSRAdmin, getAuditLogStats);
router.post("/cleanup", authenticate, requireSRAdmin, manualCleanup);

export default router;

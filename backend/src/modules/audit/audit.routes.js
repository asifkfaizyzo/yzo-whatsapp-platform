// backend/src/modules/audit/audit.routes.js (do not remove this comment)
import express from "express";
import { verifySuperAdmin } from "../../middlewares/auth.superAdmin.js";
import {
  getAuditLogs,
  getAuditLogStats,
  manualCleanup,
} from "./audit.controller.js";

const router = express.Router();

// 🔐 All routes — SuperAdmin only
router.get("/", verifySuperAdmin, getAuditLogs);
router.get("/stats", verifySuperAdmin, getAuditLogStats);
router.post("/cleanup", verifySuperAdmin, manualCleanup);

export default router;

// backend/src/modules/audit/audit.controller.js (do not remove this comment)
import {
  getAuditLogsService,
  getAuditLogStatsService,
  cleanupOldAuditLogsService,
} from "./audit.service.js";

import { extractRequestMeta } from "../../lib/utils/request.meta.js";

// GET /superadmin/audit-logs
export const getAuditLogs = async (req, res) => {
  try {
    const result = await getAuditLogsService(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /superadmin/audit-logs/stats
export const getAuditLogStats = async (req, res) => {
  try {
    const stats = await getAuditLogStatsService();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /superadmin/audit-logs/cleanup  (manual trigger)
export const manualCleanup = async (req, res) => {
  try {
    const result = await cleanupOldAuditLogsService();
    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old logs`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

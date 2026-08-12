import express              from 'express';
import { verifySuperAdmin }   from '../../middlewares/authSuperAdmin.js';
import {
  getAuditLogs,
  getAuditLogStats,
  manualCleanup,
} from './auditLogController.js';

const router = express.Router();

// 🔐 All routes — SuperAdmin only
router.get ('/',        verifySuperAdmin, getAuditLogs);
router.get ('/stats',   verifySuperAdmin, getAuditLogStats);
router.post('/cleanup', verifySuperAdmin, manualCleanup);


export default router;
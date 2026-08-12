// src/modules/webhook/dlqRoutes.js
//Dead Letter Queue
import express from 'express';
import { verifySuperAdmin } from '../../middlewares/authSuperAdmin.js';
import {
  getFailedWebhooks,
  getDLQStats,
  getFailedWebhookDetail,
  retryFailedWebhook,
  retryAllFailedWebhooks,
  deleteFailedWebhook,
  clearAllFailedWebhooks,
} from './dlqController.js';

const router = express.Router();

// 🔐 All routes require SuperAdmin auth
router.get   ('/stats',           verifySuperAdmin, getDLQStats);
router.get   ('/',                verifySuperAdmin, getFailedWebhooks);
router.get   ('/:id',             verifySuperAdmin, getFailedWebhookDetail);
router.post  ('/:id/retry',       verifySuperAdmin, retryFailedWebhook);
router.post  ('/retry-all',       verifySuperAdmin, retryAllFailedWebhooks);
router.delete('/:id',             verifySuperAdmin, deleteFailedWebhook);
router.delete('/',                verifySuperAdmin, clearAllFailedWebhooks);

export default router;
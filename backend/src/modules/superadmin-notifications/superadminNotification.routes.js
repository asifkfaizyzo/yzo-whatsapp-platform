// backend/src/modules/superadmin-notifications/superadminNotification.routes.js (do not remove this comment)

import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
  getPaginatedNotifications,
  deleteNotification,
} from "./superadminNotification.controller.js";
import { verifySuperAdmin } from "../../middlewares/auth.superAdmin.js";

const router = Router();

// All routes protected by superadmin auth
router.use(verifySuperAdmin);

router.get("/", getNotifications);
router.get("/paginated", getPaginatedNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/clear-all", clearAll);
router.delete("/:id", deleteNotification);

export default router;

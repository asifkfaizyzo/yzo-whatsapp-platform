// backend/src/modules/superAdminNotifications/superAdminNotificationRoutes.js

import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
} from "./superAdminNotificationController.js";
import { verifySuperAdmin } from "../../middlewares/authSuperAdmin.js";

const router = Router();

// All routes protected by superadmin auth
router.use(verifySuperAdmin);

router.get("/",              getNotifications);
router.patch("/:id/read",   markAsRead);
router.patch("/read-all",   markAllAsRead);
router.delete("/clear-all", clearAll);

export default router;
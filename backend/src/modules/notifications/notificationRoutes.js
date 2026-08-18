// backend/src/modules/notifications/notificationRoutes.js

import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
  getPaginatedNotifications,
  deleteNotification,
} from "./notificationController.js";
import { verifyTenantOrUser } from "../../middlewares/authVerfyTenOrUser.js";

const router = Router();

router.use(verifyTenantOrUser);

router.get("/",              getNotifications);
router.get("/paginated",     getPaginatedNotifications);
router.patch("/:id/read",   markAsRead);
router.patch("/read-all",   markAllAsRead);
router.delete("/clear-all", clearAll);
router.delete("/:id",        deleteNotification);

export default router;
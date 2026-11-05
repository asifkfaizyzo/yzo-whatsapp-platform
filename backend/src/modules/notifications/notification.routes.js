// backend/src/modules/notifications/notification.routes.js (do not remove this comment)

import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
  getPaginatedNotifications,
  deleteNotification,
} from "./notification.controller.js";
import { verifyTenantOrUser } from "../../middlewares/auth.verifyTenantOrUser.js";

const router = Router();

router.use(verifyTenantOrUser);

router.get("/", getNotifications);
router.get("/paginated", getPaginatedNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/clear-all", clearAll);
router.delete("/:id", deleteNotification);

export default router;

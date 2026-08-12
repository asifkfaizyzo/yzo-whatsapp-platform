// backend/src/modules/notifications/notificationRoutes.js

import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
} from "./notificationController.js";
import { verifyTenantOrUser } from "../../middlewares/authVerfyTenOrUser.js";

const router = Router();

router.use(verifyTenantOrUser);

router.get("/",              getNotifications);
router.patch("/:id/read",   markAsRead);
router.patch("/read-all",   markAllAsRead);
router.delete("/clear-all", clearAll);

export default router;
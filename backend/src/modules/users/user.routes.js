// backend/src/modules/users/user.routes.js (do not remove this comment)
//backend\src\modules\users\user.routes.js
import express from "express";
import * as userController from "./user.controller.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../auth/jwt.service.js";
import { forgotPasswordUser, resetPasswordUser } from "./user.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { requireUser } from "../../middleware/requireUser.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
  googleLoginSchema,
} from "../auth/auth.schema.js";
import validate from "../../middleware/validate.js";

const router = express.Router();

// ═════════════════════════════════════════
// AUTH ROUTES
// ═════════════════════════════════════════
router.post("/login-user", validate(loginSchema), userController.loginUser);
router.post("/logout-user", validate(logoutSchema), userController.logoutUser);
router.post(
  "/refresh-user-access",
  validate(refreshTokenSchema),
  userController.refreshUserAccessToken,
);
router.post(
  "/forgot-usr-password",
  validate(forgotPasswordSchema),
  userController.forgotPasswordUser,
);
router.post(
  "/reset-usr-password",
  validate(resetPasswordSchema),
  userController.resetPasswordUser,
);
router.post(
  "/google-login",
  validate(googleLoginSchema),
  userController.googleLoginUser,
);

// ═════════════════════════════════════════
// USER PROFILE ROUTES
// ═════════════════════════════════════════
router.get("/me", authenticate, requireUser, userController.getUserProfile);
router.put("/change-password", authenticate, requireUser, userController.updateUserPassword);

// ═════════════════════════════════════════
// CONTACTS
// ═════════════════════════════════════════
router.get(
  "/my-assigned-contacts",
  authenticate, requireUser,
  userController.getMyAssignedContacts,
);

// ═════════════════════════════════════════
// 🆕 AGENT AVAILABILITY
// ═════════════════════════════════════════
router.patch("/availability", authenticate, requireUser, userController.updateAvailability);

// ═════════════════════════════════════════
// 🆕 DASHBOARD STATS
// ═════════════════════════════════════════
router.get("/dashboard-stats", authenticate, requireUser, userController.getDashboardStats);

// ═════════════════════════════════════════
// 🆕 GLOBAL UNREAD BADGE
// ═════════════════════════════════════════
router.get("/unread-count", authenticate, requireUser, userController.getUnreadBadgeCount);

// ═════════════════════════════════════════
// 🆕 PUSH TOKEN
// ═════════════════════════════════════════
router.post("/push-token", authenticate, requireUser, userController.registerPushToken);
router.delete("/push-token", authenticate, requireUser, userController.clearPushToken);

router.get(
  "/notification-preferences",
  authenticate, requireTenantOrUser,
  userController.getNotificationPreferences,
);
router.patch(
  "/notification-preferences",
  authenticate, requireTenantOrUser,
  userController.updateNotificationPreferences,
);

export default router;

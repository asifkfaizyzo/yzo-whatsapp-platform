// backend/src/modules/whatsapp/whatsapp.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import {
  exchangeToken,
  setupWhatsApp,
  getWhatsAppStatus,
  getMyWabas,
  disconnectWhatsApp,
  sendLocation,
  registerPhoneNumber,
} from "./whatsapp.controller.js";
import {
  acceptCall,
  rejectCall,
  terminateCall,
  initiateCall,
  getCallPermissions,
  requestCallPermission,
  getCallSettings,
  updateCallSettings,
  uploadVoicemailGreeting,
  getCallHistory,
  getConversationCalls,
  getContactCalls,
  checkCallPermission,
} from "./call.controller.js";
import multer from "multer";

const upload = multer({ dest: "uploads/temp/" });

import validate from "../../middleware/validate.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import { sendLocationSchema, setupWhatsAppSchema } from "./whatsapp.schema.js";

const router = express.Router();

// GET /tenant/whatsapp/status - Allowed for both Tenants and Users (Agents)
router.get("/status", authenticate, requireTenantOrUser, getWhatsAppStatus);

// send-location
router.post(
  "/send-location",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(sendLocationSchema),
  sendLocation,
);

// Call Management Routes (Allowed for both Tenants and Users)
router.post("/calls/accept", authenticate, requireTenantOrUser, acceptCall);
router.post("/calls/reject", authenticate, requireTenantOrUser, rejectCall);
router.post("/calls/terminate", authenticate, requireTenantOrUser, terminateCall);
router.post(
  "/calls/initiate",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  initiateCall,
);
router.get("/calls/history", authenticate, requireTenantOrUser, getCallHistory);
router.get(
  "/calls/conversation/:conversationId",
  authenticate, requireTenantOrUser,
  getConversationCalls,
);
router.get("/calls/contact/:contactId", authenticate, requireTenantOrUser, getContactCalls);
router.get(
  "/calls/permissions/:contactId",
  authenticate, requireTenantOrUser,
  getCallPermissions,
);
router.get(
  "/calls/permissions/check/:contactId",
  authenticate, requireTenantOrUser,
  checkCallPermission,
);
router.post(
  "/calls/permissions/request",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  requestCallPermission,
);

// POST /tenant/whatsapp/exchange-token — Embedded Signup code exchange
// Must be BEFORE requireApprovedTenant (tenant may not be approved yet during onboarding)
router.post("/exchange-token", authenticate, requireTenant, exchangeToken);

// All other routes require a verified, approved tenant admin
router.use(authenticate, requireTenant);
// POST /tenant/whatsapp/setup
router.post("/setup", validate(setupWhatsAppSchema), setupWhatsApp);

router.get("/my-wabas", getMyWabas);

router.post("/disconnect", disconnectWhatsApp);
router.post("/register-phone", registerPhoneNumber);

// Call Settings Routes (Tenant Admin only)
router.get("/calls/settings/:phoneId", getCallSettings);
router.put("/calls/settings/:phoneId", updateCallSettings);
router.post(
  "/calls/settings/:phoneId/voicemail-greeting",
  upload.single("audio"),
  uploadVoicemailGreeting,
);

export default router;

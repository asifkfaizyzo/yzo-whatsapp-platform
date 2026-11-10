// backend/src/modules/templates/template.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import {
  getTemplates,
  createTemplate,
  syncTemplates,
  deleteTemplate,
} from "./template.controller.js";
import templateUpload from "../../middleware/uploadTemplate.js";

const router = express.Router();

// Fetching templates is allowed for both tenants and agent users
router.get("/", authenticate, requireTenantOrUser, checkSubscriptionAccess, getTemplates);

// Restrict creation, sync, and deletion to Tenant Admins
// templateUpload.single('headerMedia') handles multipart/form-data for media header types.
// For NONE / TEXT / LOCATION, no file is expected and req.file will simply be undefined.
router.post(
  "/create",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  templateUpload.single("headerMedia"),
  createTemplate,
);

router.post("/sync", authenticate, requireTenant, checkSubscriptionAccess, syncTemplates);
router.delete("/:id", authenticate, requireTenant, checkSubscriptionAccess, deleteTemplate);

export default router;

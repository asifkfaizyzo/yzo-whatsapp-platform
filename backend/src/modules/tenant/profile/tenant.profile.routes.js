// backend/src/modules/tenant/profile/tenant.profile.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.profile.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import validate from "../../../middleware/validate.js";
import { changePasswordSchema } from "../../auth/auth.schema.js";
import { updateTenantProfileSchema } from "./tenant.profile.schema.js";
import { logoUpload } from "../../../config/upload.logo.js";

const router = express.Router();

router.get("/me", authenticate, requireTenant, tenantController.getLoggedInTenant);
router.put(
  "/update-profile",
  authenticate, requireTenant,
  validate(updateTenantProfileSchema),
  tenantController.updateTenantProfile,
);
router.put(
  "/change-password",
  authenticate, requireTenant,
  validate(changePasswordSchema),
  tenantController.updateTenantPassword,
);
router.post(
  "/upload-logo",
  authenticate, requireTenant,
  logoUpload.single("logo"),
  tenantController.uploadTenantLogo,
);
router.delete("/delete-logo", authenticate, requireTenant, tenantController.deleteTenantLogo);

export default router;

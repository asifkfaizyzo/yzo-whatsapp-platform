// backend/src/modules/tenant/profile/tenant.profile.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.profile.controller.js";
import { verifyTenant } from "../../../middlewares/auth.tenant.js";
import validate from "../../../middlewares/validate.middleware.js";
import { changePasswordSchema } from "../../auth/auth.schema.js";
import { updateTenantProfileSchema } from "./tenant.profile.schema.js";
import { logoUpload } from "../../../config/upload.logo.js";

const router = express.Router();

router.get("/me", verifyTenant, tenantController.getLoggedInTenant);
router.put(
  "/update-profile",
  verifyTenant,
  validate(updateTenantProfileSchema),
  tenantController.updateTenantProfile,
);
router.put(
  "/change-password",
  verifyTenant,
  validate(changePasswordSchema),
  tenantController.updateTenantPassword,
);
router.post(
  "/upload-logo",
  verifyTenant,
  logoUpload.single("logo"),
  tenantController.uploadTenantLogo,
);
router.delete("/delete-logo", verifyTenant, tenantController.deleteTenantLogo);

export default router;

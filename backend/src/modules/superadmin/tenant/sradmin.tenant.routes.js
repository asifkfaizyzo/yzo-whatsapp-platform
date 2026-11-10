// backend/src/modules/superadmin/tenant/sradmin.tenant.routes.new.js (do not remove this comment)

import { Router } from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import { apiLimiter } from "../../../middleware/rateLimiter.js";
import {
  getAllTenants,
  getTenantById,
  updateTenant,
  approveTenant,
  blockTenant,
  unblockTenant,
  deactivateTenant,
  reactivateTenant,
  deleteTenant,
  deactivateUser,
  reactivateUser,
} from "./sradmin.tenant.controller.new.js";

const router = Router();

// All routes require SRAdmin authentication
router.use(authenticate, requireSRAdmin, apiLimiter);

// ── Tenant CRUD ──
router.get("/", getAllTenants);
router.get("/:id", getTenantById);
router.put("/:id", updateTenant);
router.patch("/:id/approve", approveTenant);
router.patch("/:id/block", blockTenant);
router.patch("/:id/unblock", unblockTenant);
router.patch("/:id/deactivate", deactivateTenant);
router.patch("/:id/reactivate", reactivateTenant);
router.delete("/:id", deleteTenant);

// ── User (Agent) Moderation ──
router.patch("/users/:id/deactivate", deactivateUser);
router.patch("/users/:id/reactivate", reactivateUser);

export default router;

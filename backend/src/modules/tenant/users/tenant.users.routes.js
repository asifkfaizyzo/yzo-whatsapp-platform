// backend/src/modules/tenant/users/tenant.users.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.users.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import validate from "../../../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../../users/user.schema.js";

const router = express.Router();

router.post(
  "/create-user",
  authenticate, requireTenant,
  validate(createUserSchema),
  tenantController.createUser,
);
router.get("/get-all-users", authenticate, requireTenant, tenantController.getUsersByTenant);
router.get(
  "/get-user/:id",
  authenticate, requireTenant,
  validate(userIdParamSchema),
  tenantController.getUserById,
);
router.put(
  "/update-user/:id",
  authenticate, requireTenant,
  validate(updateUserSchema),
  tenantController.updateUserById,
);
router.patch(
  "/users/:id/deactivate",
  authenticate, requireTenant,
  tenantController.deactivateUserById,
);
router.patch(
  "/users/:id/reactivate",
  authenticate, requireTenant,
  tenantController.reactivateUserById,
);
router.delete(
  "/delete-user/:id",
  authenticate, requireTenant,
  validate(userIdParamSchema),
  tenantController.deleteUserById,
);

export default router;

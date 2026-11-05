// backend/src/modules/tenant/conversations/tenant.conversations.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.conversations.controller.js";
import { verifyTenant } from "../../../middlewares/auth.tenant.js";
import validate from "../../../middlewares/validate.middleware.js";
import { updateAutoReopenSchema } from "./tenant.conversations.schema.js";

const router = express.Router();

router.get(
  "/list-User-conversations",
  verifyTenant,
  tenantController.listConversationsController,
);
router.get(
  "/auto-reopen-config",
  verifyTenant,
  tenantController.getAutoReopenConfig,
);
router.put(
  "/auto-reopen-config",
  verifyTenant,
  validate(updateAutoReopenSchema),
  tenantController.updateAutoReopenConfig,
);

export default router;

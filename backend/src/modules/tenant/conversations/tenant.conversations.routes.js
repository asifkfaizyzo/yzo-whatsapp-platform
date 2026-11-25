// backend/src/modules/tenant/conversations/tenant.conversations.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.conversations.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import validate from "../../../middleware/validate.js";
import { updateAutoReopenSchema } from "./tenant.conversations.schema.js";

const router = express.Router();

router.get(
  "/list-User-conversations",
  authenticate, requireTenant,
  tenantController.listConversationsController,
);
router.get(
  "/auto-reopen-config",
  authenticate, requireTenant,
  tenantController.getAutoReopenConfig,
);
router.put(
  "/auto-reopen-config",
  authenticate, requireTenant,
  validate(updateAutoReopenSchema),
  tenantController.updateAutoReopenConfig,
);

export default router;

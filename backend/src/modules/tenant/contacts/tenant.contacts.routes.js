// backend/src/modules/tenant/contacts/tenant.contacts.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.contacts.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";

const router = express.Router();

router.patch(
  "/assign-contact/:contactId",
  authenticate, requireTenant,
  tenantController.assignContactController,
);
router.patch(
  "/re-assign-contacts/:contactId",
  authenticate, requireTenant,
  tenantController.reassignContactController,
);
router.patch(
  "/unassign-contact/:contactId",
  authenticate, requireTenant,
  tenantController.unassignContactController,
);
router.get(
  "/unassigned-contacts",
  authenticate, requireTenant,
  tenantController.getUnassigned,
);
router.patch(
  "/assign-multiple",
  authenticate, requireTenant,
  tenantController.assignMultipleContacts,
);

export default router;

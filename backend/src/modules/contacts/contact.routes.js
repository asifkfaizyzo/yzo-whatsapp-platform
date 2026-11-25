// backend/src/modules/contacts/contact.routes.js (do not remove this comment)

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import { upload } from "../../config/multer.js";
import validate from "../../middleware/validate.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
// import prisma from '../../config/prisma.js';

// ✅ All controllers from contact.controller.js
import {
  importContactsController,
  assignContactsByPriority,
  createContactController,
  getAllContactsController,
  getContactByIdController,
  updateContactController,
  deleteContactController,
  bulkDeleteContactsController,
  blockContactController,
  unblockContactController,
  addTagToContactController,
  removeTagFromContactController,
  getContactsByUser,
  getImportGuidelinesController,
  downloadSampleCSVController,
  importPhoneContactsController,
} from "./contact.controller.js";

// ✅ Validation schemas
import {
  createContactSchema,
  updateContactSchema,
  contactIdParamSchema,
  bulkDeleteContactsSchema,
} from "./contact.schema.js";

// ✅ Import tag functions from contactCrudService
import {
  removeTagFromContact,
  checkContactTagMapping,
} from "./contact.crud.service.js";

import { createNotification } from "../notifications/notification.service.js";
import { emitToTenant } from "../../lib/socket.js";

import { getTagById } from "./contact.crud.service.js";

const router = express.Router();

// ===================== CSV GUIDELINES & SAMPLE =====================
router.get(
  "/import-guidelines",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  getImportGuidelinesController,
);

router.get(
  "/sample-csv",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  downloadSampleCSVController,
);

// ===================== CONTACT CRUD =====================
router.post(
  "/create-contact",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(createContactSchema),
  createContactController,
);

router.get(
  "/get-all-contacts",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  getAllContactsController,
);

router.get(
  "/by-user/:userId",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  getContactsByUser,
);

router.post(
  "/import",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  upload.single("file"),
  importContactsController,
);

router.get(
  "/get-contact/:id",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(contactIdParamSchema),
  getContactByIdController,
);

router.put(
  "/update-contact/:id",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(updateContactSchema),
  updateContactController,
);

router.delete(
  "/delete-contact/:id",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  validate(contactIdParamSchema),
  deleteContactController,
);

router.post(
  "/bulk-delete",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(bulkDeleteContactsSchema),
  bulkDeleteContactsController,
);

router.patch(
  "/block-contact/:id",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(contactIdParamSchema),
  blockContactController,
);

router.patch(
  "/unblock-contact/:id",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(contactIdParamSchema),
  unblockContactController,
);

router.post(
  "/bulk-delete",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  validate(bulkDeleteContactsSchema),
  bulkDeleteContactsController,
);

// ===================== PRIORITY ASSIGNMENT =====================
router.patch(
  "/assign-by-priority",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  assignContactsByPriority,
);

// ===================== TAGS =====================
// Add tag to contact
router.post(
  "/:contactId/tags",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  addTagToContactController,
);

// Delete tag from contact
// router.delete('/:contactId/tags/:tagId', authenticate, requireTenantOrUser, removeTagFromContact);
// ✅ TEST - Remove middleware temporarily
router.delete(
  "/:contactId/tags/:tagId",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  removeTagFromContactController,
);
// ===================== PHONE CONTACT IMPORT =====================
router.post(
  "/import-phone",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  importPhoneContactsController,
);

export default router;

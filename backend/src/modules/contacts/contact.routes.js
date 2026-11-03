// backend/src/modules/contacts/contact.routes.js (do not remove this comment)

import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/auth.verifyTenantOrUser.js';
import { verifyTenant } from '../../middlewares/auth.tenant.js';
import { upload } from '../../config/multer.js';
import validate from '../../middlewares/validate.middleware.js';
import { checkSubscriptionAccess } from '../../middlewares/subscription.access.js';
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
    importPhoneContactsController
} from './contact.controller.js';

// ✅ Validation schemas
import {
    createContactSchema,
    updateContactSchema,
    contactIdParamSchema,
    bulkDeleteContactsSchema 
} from './contact.schema.js';

// ✅ Import tag functions from contactCrudService
import {
    removeTagFromContact,
    checkContactTagMapping
} from './contact.crud.service.js';

import { createNotification } from '../notifications/notification.service.js';
import { emitToTenant } from '../../lib/socket.js';

import { getTagById } from './contact.crud.service.js';

const router = express.Router();

// ===================== CSV GUIDELINES & SAMPLE =====================
router.get('/import-guidelines', verifyTenantOrUser, checkSubscriptionAccess, getImportGuidelinesController);

router.get('/sample-csv', verifyTenantOrUser, checkSubscriptionAccess, downloadSampleCSVController);

// ===================== CONTACT CRUD =====================
router.post('/create-contact', verifyTenantOrUser, checkSubscriptionAccess, validate(createContactSchema), createContactController);

router.get('/get-all-contacts', verifyTenantOrUser, checkSubscriptionAccess, getAllContactsController);

router.get('/by-user/:userId', verifyTenant, checkSubscriptionAccess, getContactsByUser);

router.post('/import', verifyTenant, checkSubscriptionAccess, upload.single('file'), importContactsController);

router.get('/get-contact/:id', verifyTenantOrUser, checkSubscriptionAccess, validate(contactIdParamSchema), getContactByIdController);

router.put('/update-contact/:id', verifyTenantOrUser, checkSubscriptionAccess, validate(updateContactSchema), updateContactController);

router.delete('/delete-contact/:id', verifyTenant, checkSubscriptionAccess, validate(contactIdParamSchema), deleteContactController);

router.post('/bulk-delete', verifyTenantOrUser, checkSubscriptionAccess, validate(bulkDeleteContactsSchema), bulkDeleteContactsController);

router.patch('/block-contact/:id', verifyTenantOrUser, checkSubscriptionAccess, validate(contactIdParamSchema), blockContactController);

router.patch('/unblock-contact/:id', verifyTenantOrUser, checkSubscriptionAccess, validate(contactIdParamSchema), unblockContactController);

router.post('/bulk-delete', verifyTenantOrUser, checkSubscriptionAccess, validate(bulkDeleteContactsSchema), bulkDeleteContactsController);

// ===================== PRIORITY ASSIGNMENT =====================
router.patch('/assign-by-priority', verifyTenant, checkSubscriptionAccess, assignContactsByPriority);

// ===================== TAGS =====================
// Add tag to contact
router.post('/:contactId/tags', verifyTenantOrUser, checkSubscriptionAccess, addTagToContactController);

// Delete tag from contact 
// router.delete('/:contactId/tags/:tagId', verifyTenantOrUser, removeTagFromContact);
// ✅ TEST - Remove middleware temporarily
router.delete('/:contactId/tags/:tagId', verifyTenantOrUser, checkSubscriptionAccess, removeTagFromContactController);
// ===================== PHONE CONTACT IMPORT =====================
router.post('/import-phone', verifyTenantOrUser, checkSubscriptionAccess, importPhoneContactsController);

export default router;
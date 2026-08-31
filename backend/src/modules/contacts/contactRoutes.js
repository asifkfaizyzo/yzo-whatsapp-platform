// modules/contacts/contactRoutes.js

import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { upload } from '../../config/multerConfig.js';
import validate from '../../middlewares/validate.middleware.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
// import prisma from '../../config/prisma.js';

// ✅ All controllers from contactController.js
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
    downloadSampleCSVController
} from './contactController.js';

// ✅ Validation schemas
import {
    createContactSchema,
    updateContactSchema,
    contactIdParamSchema,
    bulkDeleteContactsSchema 
} from '../../validations/contact.validation.js';

// ✅ Import tag functions from contactCrudService
import {
    removeTagFromContact,
    checkContactTagMapping
} from './contactCrudService.js';

import { createNotification } from '../notifications/notificationService.js';
import { emitToTenant } from '../../lib/socket.js';

import { getTagById } from './contactCrudService.js';

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

export default router;
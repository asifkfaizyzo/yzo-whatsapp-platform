// modules/contacts/contactRoutes.js

import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { upload } from '../../config/multerConfig.js';
import validate from '../../middlewares/validate.middleware.js';
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
    blockContactController,
    unblockContactController,
    addTagToContactController,
    removeTagFromContactController,
    getContactsByUser
} from './contactController.js';

// ✅ Validation schemas
import {
    createContactSchema,
    updateContactSchema,
    contactIdParamSchema
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

// ===================== CONTACT CRUD =====================
router.post('/create-contact', verifyTenantOrUser, validate(createContactSchema), createContactController);

router.get('/get-all-contacts', verifyTenantOrUser, getAllContactsController);

router.get('/by-user/:userId', verifyTenant, getContactsByUser);

router.post('/import', verifyTenant, upload.single('file'), importContactsController);

router.get('/get-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), getContactByIdController);

router.put('/update-contact/:id', verifyTenantOrUser, validate(updateContactSchema), updateContactController);

router.delete('/delete-contact/:id', verifyTenant, validate(contactIdParamSchema), deleteContactController);

router.patch('/block-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), blockContactController);

router.patch('/unblock-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), unblockContactController);

// ===================== PRIORITY ASSIGNMENT =====================
router.patch('/assign-by-priority', verifyTenant, assignContactsByPriority);

// ===================== TAGS =====================
// Add tag to contact
router.post('/:contactId/tags', verifyTenantOrUser, addTagToContactController);

// Delete tag from contact 
// router.delete('/:contactId/tags/:tagId', verifyTenantOrUser, removeTagFromContact);
// ✅ TEST - Remove middleware temporarily
router.delete('/:contactId/tags/:tagId', verifyTenantOrUser, removeTagFromContactController);

export default router;
import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { upload } from '../../config/multerConfig.js';
import {
         importContactsController, assignContactsByPriority,createContactController, 
         getAllContactsController, getContactByIdController,updateContactController, 
         deleteContactController, blockContactController,unblockContactController,
         addTagToContactController,getContactsByUser
      } from './contactController.js';

import validate from '../../middlewares/validate.middleware.js';
import { createContactSchema, updateContactSchema, contactIdParamSchema } from '../../validations/contact.validation.js';
import { addTagToContact, removeTagFromContact } from './contactCrudService.js';
import { verifyTenant } from '../../middlewares/authTenant.js';


const router = express.Router();


router.post('/create-contact', verifyTenantOrUser, validate(createContactSchema), createContactController);

router.get('/get-all-contacts', verifyTenantOrUser, getAllContactsController);
//get all contacts by user id
router.get('/by-user/:userId', verifyTenant, getContactsByUser);
//importing CSV file
router.post('/import', verifyTenantOrUser, upload.single('file'), importContactsController);
// fetching contact by id
router.get('/get-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), getContactByIdController);

router.put('/update-contact/:id', verifyTenantOrUser, validate(updateContactSchema), updateContactController);

router.delete('/delete-contact/:id', verifyTenant, validate(contactIdParamSchema), deleteContactController);

router.patch('/block-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), blockContactController);

router.patch('/unblock-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), unblockContactController);




// Add Tags to Your Existing Contacts
router.post('/:contactId/tags', verifyTenant, addTagToContactController);

//assign contact by priority
router.patch('/assign-by-priority', verifyTenant, assignContactsByPriority);

export default router;
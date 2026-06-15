import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { upload } from '../../config/multerConfig.js';
import { importContactsController } from './contactController.js';
import {
    createContactController, getAllContactsController, getContactByIdController,
    updateContactController, deleteContactController, blockContactController,
    unblockContactController,
} from './contactController.js';

import validate from '../../middlewares/validate.middleware.js';
import { createContactSchema, updateContactSchema, contactIdParamSchema } from '../../validations/contact.validation.js';


const router = express.Router();


router.post('/create-contact', verifyTenantOrUser, validate(createContactSchema), createContactController);

router.get('/get-all-contacts', verifyTenantOrUser, getAllContactsController);
//importing CSV file
router.post('/import', verifyTenantOrUser, upload.single('file'), importContactsController);

router.get('/get-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), getContactByIdController);

router.put('/update-contact/:id', verifyTenantOrUser, validate(updateContactSchema), updateContactController);

router.delete('/delete-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), deleteContactController);

router.patch('/block-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), blockContactController);

router.patch('/unblock-contact/:id', verifyTenantOrUser, validate(contactIdParamSchema), unblockContactController);



export default router;
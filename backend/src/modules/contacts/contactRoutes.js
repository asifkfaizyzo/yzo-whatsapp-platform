import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import {
    createContactController, getAllContactsController, getContactByIdController,
    updateContactController, deleteContactController, blockContactController,
    unblockContactController,
} from './contactController.js';


const router = express.Router();


router.post('/create-contact', verifyTenantOrUser, createContactController);

router.get('/get-all-contacts', verifyTenantOrUser, getAllContactsController);

router.get('/get-contact/:id', verifyTenantOrUser, getContactByIdController);

router.put('/update-contact/:id', verifyTenantOrUser, updateContactController);

router.delete('/delete-contact/:id', verifyTenantOrUser, deleteContactController);

router.patch('/block-contact/:id', verifyTenantOrUser, blockContactController);

router.patch('/unblock-contact/:id', verifyTenantOrUser, unblockContactController);

export default router;
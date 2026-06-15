import express from 'express';
import * as messageController from './messageController.js';
import { verifyUser } from '../../middlewares/authUser.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';


const router = express.Router();

//Incoming Message from contact
router.post('/incoming', messageController.incomingMessageController)

//Send Message Tenant to contact
router.post("/contacts/:contactId/messages",verifyTenantOrUser,messageController.sendMessage);

export default router;
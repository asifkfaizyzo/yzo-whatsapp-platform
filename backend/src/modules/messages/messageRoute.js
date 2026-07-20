import express from 'express';
import * as messageController from './messageController.js';
import { verifyUser } from '../../middlewares/authUser.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';


const router = express.Router();

//Incoming Message from contact
router.post('/incoming', messageController.incomingMessageController)

//Send Message Tenant to contact
router.post("/contacts/:contactId/messages", verifyTenantOrUser, checkSubscriptionAccess, messageController.sendMessage);

//route for Tenant / Agent / → Contact
router.post("/contacts/:contactId/messages/media", verifyTenantOrUser, checkSubscriptionAccess, messageController.sendMediaMessage);
//Delete message by messageId
router.delete("/:messageId", verifyTenantOrUser, checkSubscriptionAccess, messageController.deleteMessageController);

export default router;
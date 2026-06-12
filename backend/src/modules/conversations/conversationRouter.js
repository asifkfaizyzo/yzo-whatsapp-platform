import express from 'express';
import * as conversationController from './conversationController.js';
import { verifyUser } from '../../middlewares/authUser.js';
import { verifyTenantOrUser} from '../../middlewares/authVerfyTenOrUser.js'

const router = express.Router();

router.post('/create-conversation', verifyTenantOrUser,conversationController.createConversation);

router.get('/conversation/:contactId',verifyUser,conversationController.getConversationController);
//conversations assigned to the logged in user
router.get("/assigned", verifyUser,conversationController.getAssignedConversationsController);

router.get('/getmessage/:conversationId', verifyUser,conversationController.getMessagesController);


export default router;
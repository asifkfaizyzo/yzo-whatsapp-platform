import express from 'express';
import * as conversationController from './conversationController.js';
// import { verifyUser } from '../../middlewares/authUser.js';
import { verifyTenantOrUser} from '../../middlewares/authVerfyTenOrUser.js'

const router = express.Router();

router.post('/create-conversation', verifyTenantOrUser,conversationController.createConversation);

router.get('/conversation/:contactId',verifyTenantOrUser,conversationController.getConversationController);
//conversations assigned to the logged in user
router.get("/assigned", verifyTenantOrUser,conversationController.getAssignedConversationsController);

router.get('/getmessage/:conversationId', verifyTenantOrUser,conversationController.getMessagesController);

// Update conversation status
router.patch('/status/:conversationId', verifyTenantOrUser, conversationController.updateConversationStatusController);


// ── New Routes ────────────────────────────────────────────
router.patch('/archive/:conversationId',   verifyTenantOrUser, conversationController.archiveConversationController);
router.patch('/unarchive/:conversationId', verifyTenantOrUser, conversationController.unarchiveConversationController);
router.delete('/delete/:conversationId',   verifyTenantOrUser, conversationController.deleteConversationController);
router.get('/archived',                    verifyTenantOrUser, conversationController.getArchivedConversationsController);

export default router;
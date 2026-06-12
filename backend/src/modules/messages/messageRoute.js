import express from 'express';
import * as messageController from './messageController.js';
import { verifyUser } from '../../middlewares/authUser.js';

const router = express.Router();

router.post('/incoming', messageController.incomingMessageController)

router.post('/send',verifyUser, messageController.sendMessageController);

export default router;
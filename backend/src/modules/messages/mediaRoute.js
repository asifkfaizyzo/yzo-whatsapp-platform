// src/modules/messages/mediaRoute.js

import express                from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import {
  serveMediaFile,
  refreshMediaUrl,
} from './mediaController.js';

const router = express.Router();

// Public - signed URL is self authenticating
router.get('/serve', serveMediaFile);

// Protected - needs auth token to refresh URL
router.get('/refresh/:messageId', verifyTenantOrUser, refreshMediaUrl);

export default router;
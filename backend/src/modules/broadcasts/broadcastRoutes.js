import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { getBroadcasts, getBroadcastStats, launchBroadcast } from './broadcastController.js';

const router = express.Router();

// Viewing broadcasts list and stats is allowed for users (agents) and tenants
router.get('/', verifyTenantOrUser, getBroadcasts);
router.get('/:id/stats', verifyTenantOrUser, getBroadcastStats);

// RESTRICT launching to Tenant Admins
router.post('/launch', verifyTenant, launchBroadcast);

export default router;
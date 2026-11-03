// backend/src/modules/tenant/tenant.routes.js (do not remove this comment)
import express from 'express';
import authRoutes from './auth/tenant.auth.routes.js';
import profileRoutes from './profile/tenant.profile.routes.js';
import usersRoutes from './users/tenant.users.routes.js';
import contactsRoutes from './contacts/tenant.contacts.routes.js';
import conversationsRoutes from './conversations/tenant.conversations.routes.js';
import integrationsRoutes from './integrations/tenant.integrations.routes.js';

const router = express.Router();

router.use('/', authRoutes);
router.use('/', profileRoutes);
router.use('/', usersRoutes);
router.use('/', contactsRoutes);
router.use('/', conversationsRoutes);
router.use('/', integrationsRoutes);

export default router;
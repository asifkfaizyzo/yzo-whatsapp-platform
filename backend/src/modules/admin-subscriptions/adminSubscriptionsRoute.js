import { Router } from 'express';
import { verifySuperAdmin } from '../../middlewares/authSuperAdmin.js';
import * as adminSubscriptionsController from './adminSubscriptionsController.js';

const router = Router();

router.get('/', verifySuperAdmin, adminSubscriptionsController.getSubscriptions);
router.patch('/:tenantId', verifySuperAdmin, adminSubscriptionsController.updateSubscription);

export default router;
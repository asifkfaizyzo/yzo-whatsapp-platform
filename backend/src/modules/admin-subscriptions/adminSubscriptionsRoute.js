import { Router } from 'express';
import { verifySuperAdmin } from '../../middlewares/authSuperAdmin.js';
import * as adminSubscriptionsController from './adminSubscriptionsController.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many admin requests. Please wait a minute before trying again."
  }
});

router.get('/', verifySuperAdmin, adminSubscriptionsController.getSubscriptions);
router.patch('/:tenantId', verifySuperAdmin, adminSubscriptionsController.updateSubscription);
router.post('/:tenantId/manual-activate', verifySuperAdmin, adminActionLimiter, adminSubscriptionsController.manualPlanActivation);

export default router;
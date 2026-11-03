// backend/src/modules/billing/billing.routes.js (do not remove this comment)
import { Router } from 'express';
import { verifyTenant } from '../../middlewares/auth.tenant.js';
import { checkSubscriptionAccess } from '../../middlewares/subscription.access.js';
import * as billingController from './billing.controller.js';

const router = Router();

router.post('/cancel', verifyTenant, billingController.cancelSubscription);
router.post('/cancel-autopay', verifyTenant, billingController.cancelAutopay);
router.post('/reactivate', verifyTenant, billingController.reactivateSubscription);
router.post('/pause', verifyTenant, billingController.pauseSubscription);
router.post('/resume', verifyTenant, billingController.resumeSubscription);
router.get('/', verifyTenant, checkSubscriptionAccess, billingController.getBillingOverview);
router.get('/invoices', verifyTenant, checkSubscriptionAccess, billingController.getInvoices);
router.get('/invoices/:id/download', verifyTenant, billingController.downloadInvoicePdf);

export default router;
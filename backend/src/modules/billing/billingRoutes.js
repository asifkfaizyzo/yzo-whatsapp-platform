import { Router } from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import * as billingController from './billingController.js';

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
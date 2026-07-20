import { Router } from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import * as billingController from './billingController.js';

const router = Router();

router.post('/cancel', verifyTenant, billingController.cancelSubscription);
router.post('/reactivate', verifyTenant, billingController.reactivateSubscription);
router.get('/', verifyTenant, checkSubscriptionAccess, billingController.getBillingOverview);
router.get('/invoices', verifyTenant, checkSubscriptionAccess, billingController.getInvoices);
router.get('/invoices/:id/download', verifyTenant, billingController.downloadInvoicePdf);

export default router;
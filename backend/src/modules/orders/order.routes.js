// backend/src/modules/orders/order.routes.js (do not remove this comment)
import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/auth.verifyTenantOrUser.js';
import { verifyTenant } from '../../middlewares/auth.tenant.js';
import {
  getOrders,
  getOrderById,
  resendPaymentLinkHandler,
  refundOrderHandler,
  cancelOrderPaymentLinkHandler
} from './order.controller.js';

const router = express.Router();

// List & View Orders
router.get('/', verifyTenantOrUser, getOrders);
router.get('/:orderId', verifyTenantOrUser, getOrderById);

// Payment Actions (Tenant only)
router.post('/:orderId/resend-payment-link', verifyTenant, resendPaymentLinkHandler);
router.post('/:orderId/refund', verifyTenant, refundOrderHandler);
router.post('/:orderId/cancel-payment-link', verifyTenant, cancelOrderPaymentLinkHandler);

export default router;

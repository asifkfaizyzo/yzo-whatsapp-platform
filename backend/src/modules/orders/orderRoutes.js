// backend/src/modules/orders/orderRoutes.js
import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { verifyTenant } from '../../middlewares/authTenant.js';
import {
  getOrders,
  getOrderById,
  resendPaymentLinkHandler,
  refundOrderHandler,
  cancelOrderPaymentLinkHandler
} from './orderController.js';

const router = express.Router();

// List & View Orders
router.get('/', verifyTenantOrUser, getOrders);
router.get('/:orderId', verifyTenantOrUser, getOrderById);

// Payment Actions (Tenant only)
router.post('/:orderId/resend-payment-link', verifyTenant, resendPaymentLinkHandler);
router.post('/:orderId/refund', verifyTenant, refundOrderHandler);
router.post('/:orderId/cancel-payment-link', verifyTenant, cancelOrderPaymentLinkHandler);

export default router;

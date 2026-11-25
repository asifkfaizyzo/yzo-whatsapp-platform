// backend/src/modules/orders/order.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import {
  getOrders,
  getOrderById,
  resendPaymentLinkHandler,
  refundOrderHandler,
  cancelOrderPaymentLinkHandler,
} from "./order.controller.js";

const router = express.Router();

// List & View Orders
router.get("/", authenticate, requireTenantOrUser, getOrders);
router.get("/:orderId", authenticate, requireTenantOrUser, getOrderById);

// Payment Actions (Tenant only)
router.post(
  "/:orderId/resend-payment-link",
  authenticate, requireTenant,
  resendPaymentLinkHandler,
);
router.post("/:orderId/refund", authenticate, requireTenant, refundOrderHandler);
router.post(
  "/:orderId/cancel-payment-link",
  authenticate, requireTenant,
  cancelOrderPaymentLinkHandler,
);

export default router;

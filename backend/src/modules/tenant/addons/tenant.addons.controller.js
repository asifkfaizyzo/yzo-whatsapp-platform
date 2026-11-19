// backend/src/modules/tenant/addons/tenant.addons.controller.js (do not remove this comment)
import {
  listTenantAddOnsService,
  createAddOnOrderService,
  verifyAddOnOrderService,
  createAddOnSubscriptionService,
  verifyAddOnSubscriptionService,
  cancelTenantAddOnService,
} from "./tenant.addons.service.js";
import { sendSuccess } from "../../../utils/response.js";

function extractAuditMeta(req) {
  return {
    actorId: req.user?.id || req.tenant?.id || null,
    actorName:
      req.user?.name ||
      req.tenant?.businessName ||
      req.tenant?.email ||
      null,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.get("user-agent") || null,
  };
}

/**
 * GET /tenant/billing/addons
 */
export async function listTenantAddOns(req, res, next) {
  try {
    const data = await listTenantAddOnsService(req.tenant.id);
    return sendSuccess(res, data, "Add-ons and credit pools fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/addons/create-order
 */
export async function createAddOnOrder(req, res, next) {
  try {
    const data = await createAddOnOrderService(req.tenant.id, req.body);
    return sendSuccess(res, data, "Add-on payment order created successfully", 201);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/addons/verify-order
 */
export async function verifyAddOnOrder(req, res, next) {
  try {
    const data = await verifyAddOnOrderService(
      req.tenant.id,
      req.body,
      extractAuditMeta(req)
    );
    return sendSuccess(
      res,
      data,
      data.purchaseType === "TOPUP"
        ? "Credit top-up verified and added to your balance"
        : "Add-on verified and activated successfully"
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/addons/create-subscription
 */
export async function createAddOnSubscription(req, res, next) {
  try {
    const data = await createAddOnSubscriptionService(req.tenant.id, req.body);
    return sendSuccess(
      res,
      data,
      "Recurring add-on subscription created successfully",
      201
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/addons/verify-subscription
 */
export async function verifyAddOnSubscription(req, res, next) {
  try {
    const data = await verifyAddOnSubscriptionService(
      req.tenant.id,
      req.body,
      extractAuditMeta(req)
    );
    return sendSuccess(
      res,
      data,
      "Recurring add-on verified and autopay activated successfully"
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/addons/:tenantAddOnId/cancel
 */
export async function cancelTenantAddOn(req, res, next) {
  try {
    const data = await cancelTenantAddOnService(
      req.tenant.id,
      req.params.tenantAddOnId,
      req.body,
      extractAuditMeta(req)
    );
    return sendSuccess(
      res,
      data,
      "Add-on cancelled. Your extra capacity remains active until the end of the current billing period."
    );
  } catch (err) {
    return next(err);
  }
}

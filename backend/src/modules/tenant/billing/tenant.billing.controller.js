// backend/src/modules/tenant/billing/tenant.billing.controller.js (do not remove this comment)
import fs from "fs";
import {
  getBillingOverviewService,
  cancelSubscriptionService,
  reactivateSubscriptionService,
  pauseSubscriptionService,
  resumeSubscriptionService,
  listTenantInvoicesService,
  listTenantPaymentsService,
  getTenantInvoicePdfByInvoiceIdService,
  getTenantInvoicePdfByPaymentIdService,
} from "./tenant.billing.service.js";
import { success } from "../../../utils/response.js";

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
 * GET /tenant/billing/overview (and /tenant/billing/details)
 */
export async function getBillingOverview(req, res, next) {
  try {
    const data = await getBillingOverviewService(req.tenant.id);
    return success(res, data, "Billing overview fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/cancel (and /tenant/billing/cancel-autopay)
 */
export async function cancelSubscription(req, res, next) {
  try {
    const data = await cancelSubscriptionService(
      req.tenant.id,
      req.body,
      extractAuditMeta(req)
    );
    return success(
      res,
      data,
      "Subscription cancelled. You will retain full access until the end of your current billing period."
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/reactivate
 */
export async function reactivateSubscription(req, res, next) {
  try {
    const data = await reactivateSubscriptionService(
      req.tenant.id,
      extractAuditMeta(req)
    );
    return success(res, data, "Subscription reactivated successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/pause
 */
export async function pauseSubscription(req, res, next) {
  try {
    const data = await pauseSubscriptionService(
      req.tenant.id,
      extractAuditMeta(req)
    );
    return success(res, data, "Subscription paused successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/billing/resume
 */
export async function resumeSubscription(req, res, next) {
  try {
    const data = await resumeSubscriptionService(
      req.tenant.id,
      extractAuditMeta(req)
    );
    return success(res, data, "Subscription resumed successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /tenant/billing/invoices
 */
export async function listTenantInvoices(req, res, next) {
  try {
    const data = await listTenantInvoicesService(req.tenant.id, req.query);
    return success(res, data, "Invoices fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /tenant/billing/payments
 */
export async function listTenantPayments(req, res, next) {
  try {
    const data = await listTenantPaymentsService(req.tenant.id, req.query);
    return success(res, data, "Payments fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /tenant/billing/invoices/:invoiceId/download
 */
export async function downloadInvoiceById(req, res, next) {
  try {
    const { filePath, fileName } = await getTenantInvoicePdfByInvoiceIdService(
      req.tenant.id,
      req.params.invoiceId
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const stream = fs.createReadStream(filePath);
    stream.on("error", (streamErr) => next(streamErr));
    return stream.pipe(res);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /tenant/billing/payments/:paymentId/invoice
 */
export async function downloadInvoiceByPaymentId(req, res, next) {
  try {
    const { filePath, fileName } = await getTenantInvoicePdfByPaymentIdService(
      req.tenant.id,
      req.params.paymentId
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const stream = fs.createReadStream(filePath);
    stream.on("error", (streamErr) => next(streamErr));
    return stream.pipe(res);
  } catch (err) {
    return next(err);
  }
}
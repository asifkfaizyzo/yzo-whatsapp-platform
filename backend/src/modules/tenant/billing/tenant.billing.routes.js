// backend/src/modules/tenant/billing/tenant.billing.routes.js (do not remove this comment)
import { Router } from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import {
  cancelSubscriptionSchema,
  listBillingInvoicesQuerySchema,
  listBillingPaymentsQuerySchema,
  invoiceDownloadParamSchema,
  paymentInvoiceParamSchema,
} from "./tenant.billing.schema.js";
import {
  getBillingOverview,
  cancelSubscription,
  reactivateSubscription,
  pauseSubscription,
  resumeSubscription,
  listTenantInvoices,
  listTenantPayments,
  downloadInvoiceById,
  downloadInvoiceByPaymentId,
} from "./tenant.billing.controller.js";

const router = Router();

function validateRequest({ params, query, body }) {
  return (req, _res, next) => {
    if (params) {
      const parsed = params.safeParse(req.params);
      if (!parsed.success) {
        return next(
          new HttpError(
            400,
            parsed.error.issues[0]?.message || "Invalid route parameters",
            "VALIDATION_ERROR",
          ),
        );
      }
      Object.assign(req.params, parsed.data);
    }

    if (query) {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) {
        return next(
          new HttpError(
            400,
            parsed.error.issues[0]?.message || "Invalid query parameters",
            "VALIDATION_ERROR",
          ),
        );
      }
      req.query = parsed.data;
    }

    if (body) {
      const parsed = body.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(
          new HttpError(
            400,
            parsed.error.issues[0]?.message || "Invalid request body",
            "VALIDATION_ERROR",
          ),
        );
      }
      req.body = parsed.data;
    }

    return next();
  };
}

router.use(authenticate, requireTenant);

// ── Overview & Details ──────────────────────────────────────────
router.get("/overview", getBillingOverview);
router.get("/details", getBillingOverview);

// ── Subscription Lifecycle Actions ──────────────────────────────
router.post(
  "/cancel",
  validateRequest({ body: cancelSubscriptionSchema }),
  cancelSubscription,
);

router.post(
  "/cancel-autopay",
  validateRequest({ body: cancelSubscriptionSchema }),
  cancelSubscription,
);

router.post("/reactivate", reactivateSubscription);
router.post("/pause", pauseSubscription);
router.post("/resume", resumeSubscription);

// ── Invoices & Payments History ─────────────────────────────────
router.get(
  "/invoices",
  validateRequest({ query: listBillingInvoicesQuerySchema }),
  listTenantInvoices,
);

router.get(
  "/payments",
  validateRequest({ query: listBillingPaymentsQuerySchema }),
  listTenantPayments,
);

// ── Invoice PDF Downloads ───────────────────────────────────────
router.get(
  "/invoices/:invoiceId/download",
  validateRequest({ params: invoiceDownloadParamSchema }),
  downloadInvoiceById,
);

router.get(
  "/payments/:paymentId/invoice",
  validateRequest({ params: paymentInvoiceParamSchema }),
  downloadInvoiceByPaymentId,
);

export default router;

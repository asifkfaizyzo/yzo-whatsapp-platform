// backend/src/modules/tenant/plans/tenant.plans.routes.js (do not remove this comment)
import { Router } from "express";
import authenticate from "../../../middleware/auth.middleware.js";
import requireTenant from "../../../middleware/requireTenant.js";
import { HttpError } from "../../../utils/httpError.js";
import {
  publicPlanParamSchema,
  startTrialSchema,
  schedulePlanChangeSchema,
} from "./tenant.plans.schema.js";
import {
  listPublicPlans,
  getPublicPlanById,
  listTenantPlans,
  startTrial,
  schedulePlanChange,
  clearScheduledPlanChange,
} from "./tenant.plans.controller.js";

const router = Router();

function validateRequest({ params, body }) {
  return (req, _res, next) => {
    if (params) {
      const parsed = params.safeParse(req.params);
      if (!parsed.success) {
        return next(
          new HttpError(
            400,
            parsed.error.issues[0]?.message || "Invalid route parameters",
            "VALIDATION_ERROR"
          )
        );
      }
      Object.assign(req.params, parsed.data);
    }

    if (body) {
      const parsed = body.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(
          new HttpError(
            400,
            parsed.error.issues[0]?.message || "Invalid request body",
            "VALIDATION_ERROR"
          )
        );
      }
      req.body = parsed.data;
    }

    return next();
  };
}

// ── Public Catalog Routes (No Auth Required) ────────────────────
router.get("/public", listPublicPlans);
router.get(
  "/public/:id",
  validateRequest({ params: publicPlanParamSchema }),
  getPublicPlanById
);

// ── Authenticated Tenant Plan Routes ────────────────────────────
router.get("/", authenticate, requireTenant, listTenantPlans);

router.post(
  "/start-trial",
  authenticate,
  requireTenant,
  validateRequest({ body: startTrialSchema }),
  startTrial
);

router.post(
  "/schedule-change",
  authenticate,
  requireTenant,
  validateRequest({ body: schedulePlanChangeSchema }),
  schedulePlanChange
);

router.delete(
  "/schedule-change",
  authenticate,
  requireTenant,
  clearScheduledPlanChange
);

export default router;
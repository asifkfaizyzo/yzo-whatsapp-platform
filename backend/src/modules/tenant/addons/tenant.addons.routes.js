// backend/src/modules/tenant/addons/tenant.addons.routes.js (do not remove this comment)
import { Router } from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import { HttpError } from "../../../utils/httpError.js";
import {
  tenantAddOnIdParamSchema,
  createAddOnOrderSchema,
  verifyAddOnOrderSchema,
  createAddOnSubscriptionSchema,
  verifyAddOnSubscriptionSchema,
  cancelTenantAddOnSchema,
} from "./tenant.addons.schema.js";
import {
  listTenantAddOns,
  createAddOnOrder,
  verifyAddOnOrder,
  createAddOnSubscription,
  verifyAddOnSubscription,
  cancelTenantAddOn,
} from "./tenant.addons.controller.js";

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

router.use(authenticate, requireTenant);

router.get("/", listTenantAddOns);

router.post(
  "/create-order",
  validateRequest({ body: createAddOnOrderSchema }),
  createAddOnOrder
);

router.post(
  "/verify-order",
  validateRequest({ body: verifyAddOnOrderSchema }),
  verifyAddOnOrder
);

router.post(
  "/create-subscription",
  validateRequest({ body: createAddOnSubscriptionSchema }),
  createAddOnSubscription
);

router.post(
  "/verify-subscription",
  validateRequest({ body: verifyAddOnSubscriptionSchema }),
  verifyAddOnSubscription
);

router.post(
  "/:tenantAddOnId/cancel",
  validateRequest({
    params: tenantAddOnIdParamSchema,
    body: cancelTenantAddOnSchema,
  }),
  cancelTenantAddOn
);

export default router;

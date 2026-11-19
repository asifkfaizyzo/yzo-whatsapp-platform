// backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.controller.js (do not remove this comment)
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";
import { parseOrThrow, sendError } from "../../../lib/utils/http.error.js";
import * as schemas from "./sradmin.subscriptions.schema.js";
import * as service from "./sradmin.subscriptions.service.js";

const actorOf = (req) => ({
  id: req.srAdmin.id,
  name: req.srAdmin.name,
  email: req.srAdmin.email,
});

const ok = (res, message, data, status = 200) =>
  res.status(status).json({ success: true, message, data });

export const listSubscriptions = async (req, res) => {
  try {
    const query = parseOrThrow(schemas.listQuerySchema, req.query);
    const data = await service.listSubscriptionsService(query);
    return ok(res, "Subscriptions fetched", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getSubscription = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const data = await service.getSubscriptionDetailService(tenantId);
    return ok(res, "Subscription fetched", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const extendSubscription = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.extendSchema, req.body ?? {});
    const data = await service.extendSubscriptionService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, `Subscription extended by ${body.days} day(s)`, data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const extendTrial = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.extendTrialSchema, req.body ?? {});
    const data = await service.extendTrialService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, `Trial extended by ${body.days} day(s)`, data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const changePlan = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.changePlanSchema, req.body ?? {});
    const data = await service.changePlanService(tenantId, body, actorOf(req), extractRequestMeta(req));
    const message = {
      IMMEDIATE: "Plan changed",
      AT_PERIOD_END: "Plan change scheduled for period end",
      CLEAR_PENDING: "Scheduled plan change cleared",
    }[body.mode];
    return ok(res, message, data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const manualActivate = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.manualActivateSchema, req.body ?? {});
    const data = await service.manualActivateService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, "Plan activated manually", data, 201);
  } catch (error) {
    return sendError(res, error);
  }
};

export const pauseSubscription = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.pauseSchema, req.body ?? {});
    const data = await service.pauseSubscriptionService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, "Subscription paused", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const reactivateSubscription = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.reactivateSchema, req.body ?? {});
    const data = await service.reactivateSubscriptionService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, "Subscription reactivated", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const expireSubscription = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.expireSchema, req.body ?? {});
    const data = await service.expireSubscriptionService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, "Subscription expired", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateLimits = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.updateLimitsSchema, req.body ?? {});
    const data = await service.updateLimitsService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, data.changed ? "Custom limits updated" : "No changes", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateGrace = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.updateGraceSchema, req.body ?? {});
    const data = await service.updateGraceService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, data.changed ? "Grace period updated" : "No changes", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateFreeUntil = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.updateFreeUntilSchema, req.body ?? {});
    const data = await service.updateFreeUntilService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, data.changed ? "Free-until date updated" : "No changes", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const grantAddOn = async (req, res) => {
  try {
    const { tenantId } = parseOrThrow(schemas.tenantParamSchema, req.params);
    const body = parseOrThrow(schemas.grantAddOnSchema, req.body ?? {});
    const data = await service.grantAddOnService(tenantId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, "Add-on granted", data, 201);
  } catch (error) {
    return sendError(res, error);
  }
};

export const revokeAddOn = async (req, res) => {
  try {
    const { tenantId, tenantAddOnId } = parseOrThrow(schemas.tenantAddOnParamSchema, req.params);
    const body = parseOrThrow(schemas.revokeAddOnSchema, req.body ?? {});
    const data = await service.revokeAddOnService(tenantId, tenantAddOnId, body, actorOf(req), extractRequestMeta(req));
    return ok(res, "Add-on revoked", data);
  } catch (error) {
    return sendError(res, error);
  }
};

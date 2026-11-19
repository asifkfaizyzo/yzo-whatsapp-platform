// backend/src/modules/tenant/plans/tenant.plans.controller.js (do not remove this comment)
import {
  listPublicPlansService,
  getPublicPlanByIdService,
  listTenantPlansService,
  startTrialService,
  schedulePlanChangeService,
  clearScheduledPlanChangeService,
} from "./tenant.plans.service.js";
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
 * GET /tenant/plans/public
 */
export async function listPublicPlans(req, res, next) {
  try {
    const data = await listPublicPlansService();
    return sendSuccess(res, data, "Public plans fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /tenant/plans/public/:id
 */
export async function getPublicPlanById(req, res, next) {
  try {
    const data = await getPublicPlanByIdService(req.params.id);
    return sendSuccess(res, data, "Plan fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /tenant/plans
 */
export async function listTenantPlans(req, res, next) {
  try {
    const data = await listTenantPlansService(req.tenant.id);
    return sendSuccess(res, data, "Tenant plans fetched successfully");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/plans/start-trial
 */
export async function startTrial(req, res, next) {
  try {
    const data = await startTrialService(
      req.tenant.id,
      req.body,
      extractAuditMeta(req)
    );
    return sendSuccess(res, data, "Free trial started successfully", 201);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /tenant/plans/schedule-change
 */
export async function schedulePlanChange(req, res, next) {
  try {
    const data = await schedulePlanChangeService(
      req.tenant.id,
      req.body,
      extractAuditMeta(req)
    );
    return sendSuccess(
      res,
      data,
      "Plan change scheduled for the end of your current billing period"
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /tenant/plans/schedule-change
 */
export async function clearScheduledPlanChange(req, res, next) {
  try {
    const data = await clearScheduledPlanChangeService(
      req.tenant.id,
      extractAuditMeta(req)
    );
    return sendSuccess(res, data, "Scheduled plan change cancelled");
  } catch (err) {
    return next(err);
  }
}
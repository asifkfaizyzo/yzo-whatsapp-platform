// backend/src/modules/superadmin/plans/sradmin.plans.controller.js (do not remove this comment)

import { parseOrThrow, sendError } from "../../../lib/utils/http.error.js";
import { logAdminAction } from "../../../lib/utils/admin.audit.js";
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";
import {
  createPlanSchema,
  updatePlanSchema,
  reorderPlansSchema,
  idParamSchema,
  listPlansQuerySchema,
} from "./sradmin.plans.schema.js";
import {
  getRegistryMetadataService,
  listPlansService,
  getPlanByIdService,
  createPlanService,
  updatePlanService,
  togglePlanStatusService,
  reorderPlansService,
  deletePlanService,
} from "./sradmin.plans.service.js";

const actorFrom = (req) => ({
  id: req.srAdmin?.id,
  name: req.srAdmin?.name,
  email: req.srAdmin?.email,
});

// ── GET /sradmin/plans ──
export const listPlans = async (req, res) => {
  try {
    const filters = parseOrThrow(listPlansQuerySchema, req.query);
    const plans = await listPlansService(filters);
    return res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data: plans,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── GET /sradmin/plans/registry ──
export const getRegistry = async (req, res) => {
  try {
    const data = getRegistryMetadataService();
    return res.status(200).json({
      success: true,
      message: "Entitlement registry fetched successfully",
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── GET /sradmin/plans/:id ──
export const getPlan = async (req, res) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const plan = await getPlanByIdService(id);
    return res.status(200).json({
      success: true,
      message: "Plan fetched successfully",
      data: plan,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── POST /sradmin/plans ──
export const createPlan = async (req, res) => {
  try {
    const input = parseOrThrow(createPlanSchema, req.body);
    const plan = await createPlanService(input);

    await logAdminAction(actorFrom(req), extractRequestMeta(req), {
      action: "PLAN_CREATED",
      module: "BILLING",
      description: `Created ${plan.planType} plan '${plan.name}'`,
      targetId: plan.id,
      targetType: "SubscriptionPlan",
      targetName: plan.name,
      metadata: {
        planType: plan.planType,
        visibility: plan.visibility,
        customTenantId: plan.customTenantId,
        monthlyPrice: plan.monthlyPrice,
        quarterlyPrice: plan.quarterlyPrice,
        annualPrice: plan.annualPrice,
        hasTrial: plan.hasTrial,
        trialDays: plan.trialDays,
        entitlements: plan.entitlements,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── PUT /sradmin/plans/:id ──
export const updatePlan = async (req, res) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const input = parseOrThrow(updatePlanSchema, req.body);
    const { plan, impact, changes } = await updatePlanService(id, input);

    // Only log real changes (a PUT that changes nothing is not an auditable event)
    if (Object.keys(changes).length > 0) {
      await logAdminAction(actorFrom(req), extractRequestMeta(req), {
        action: "PLAN_UPDATED",
        module: "BILLING",
        description: `Updated plan '${plan.name}' (${Object.keys(changes).join(", ")})`,
        targetId: plan.id,
        targetType: "SubscriptionPlan",
        targetName: plan.name,
        metadata: { changes, impact },
      });
    }

    const notes = ["Plan updated successfully"];
    if (impact.razorpayPlanIdsReset.length) {
      notes.push(
        `price change applies to new subscriptions only (reset: ${impact.razorpayPlanIdsReset.join(", ")})`
      );
    }
    if (impact.entitlementsChanged && impact.activeSubscribers > 0) {
      notes.push(
        `entitlement changes are live for ${impact.activeSubscribers} active subscriber(s)`
      );
    }

    return res.status(200).json({
      success: true,
      message: notes.join(" — "),
      data: plan,
      impact,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── PATCH /sradmin/plans/:id/toggle-status ──
export const togglePlanStatus = async (req, res) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const plan = await togglePlanStatusService(id);

    const previous = plan.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await logAdminAction(actorFrom(req), extractRequestMeta(req), {
      action: "PLAN_STATUS_CHANGED",
      module: "BILLING",
      description: `Plan '${plan.name}' ${previous} → ${plan.status}`,
      targetId: plan.id,
      targetType: "SubscriptionPlan",
      targetName: plan.name,
      metadata: { from: previous, to: plan.status },
    });

    return res.status(200).json({
      success: true,
      message: `Plan is now ${plan.status}`,
      data: plan,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── PATCH /sradmin/plans/reorder ──
export const reorderPlans = async (req, res) => {
  try {
    const { orderedIds } = parseOrThrow(reorderPlansSchema, req.body);
    const plans = await reorderPlansService(orderedIds);

    await logAdminAction(actorFrom(req), extractRequestMeta(req), {
      action: "PLANS_REORDERED",
      module: "BILLING",
      description: `Reordered ${orderedIds.length} plans`,
      targetType: "SubscriptionPlan",
      metadata: { orderedIds },
    });

    return res.status(200).json({
      success: true,
      message: "Plans reordered successfully",
      data: plans,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ── DELETE /sradmin/plans/:id ──
export const deletePlan = async (req, res) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const deleted = await deletePlanService(id);

    await logAdminAction(actorFrom(req), extractRequestMeta(req), {
      action: "PLAN_DELETED",
      module: "BILLING",
      description: `Deleted plan '${deleted.name}'`,
      targetId: deleted.id,
      targetType: "SubscriptionPlan",
      targetName: deleted.name,
    });

    return res.status(200).json({
      success: true,
      message: `Plan '${deleted.name}' deleted successfully`,
      data: deleted,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
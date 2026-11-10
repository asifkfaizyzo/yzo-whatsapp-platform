// backend/src/middleware/requireTenantOrUser.js (do not remove this comment)

/**
 * Combined Tenant-or-User role guard.
 *
 * Must be used AFTER authenticate middleware.
 * Handles routes that are accessible to both tenant admins and their agents.
 *
 * For TENANT actors:
 *   - Loads tenant, checks BLOCKED / inactive / PENDING status
 *   - PENDING tenants are allowed ONLY on payment routes (plan checkout)
 *   - Sets req.tenant, req.tenantId
 *
 * For USER actors:
 *   - Loads user + parent tenant, checks both are active and not BLOCKED
 *   - PENDING parent tenant blocks the user entirely (agents can't pay)
 *   - Sets req.user, req.userId, req.tenantId
 *
 * This replaces the old verifyTenantOrUser from middlewares/auth.verifyTenantOrUser.js
 */

import prisma from "../config/prisma.js";
import { error } from "../utils/response.js";

const PAYMENT_ROUTES = [
  "/plans/create-order",
  "/plans/verify-payment",
  "/plans/public",
];

const isPaymentRoute = (url) =>
  PAYMENT_ROUTES.some((route) => url.includes(route));

export const requireTenantOrUser = async (req, res, next) => {
  // ── TENANT ──────────────────────────────────────────────────────
  if (req.actorType === "TENANT") {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.actorId },
        select: {
          id: true,
          tenantName: true,
          email: true,
          username: true,
          phone: true,
          status: true,
          isActive: true,
          onboardingStep: true,
          onboardingCompleted: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              planId: true,
              planStatus: true,
              billingType: true,
              subscriptionStatus: true,
              currentPlan: true,
              planPeriodStart: true,
              planPeriodEnd: true,
            },
          },
        },
      });

      if (!tenant) {
        return error(res, "Tenant account not found", 404);
      }

      if (tenant.status === "BLOCKED") {
        return error(res, "Your account has been blocked", 403);
      }

      if (!tenant.isActive) {
        return error(res, "Your account has been deactivated", 403);
      }

      // PENDING tenants can only access payment routes
      if (tenant.status === "PENDING" && !isPaymentRoute(req.originalUrl)) {
        return error(res, "Your account is pending approval", 403);
      }

      // Flatten subscription for convenience
      if (tenant.subscription) {
        Object.assign(tenant, tenant.subscription);
        delete tenant.subscription;
      }

      req.tenant = tenant;
      req.tenantId = tenant.id;

      return next();
    } catch (err) {
      return error(res, "Failed to verify tenant account", 500);
    }
  }

  // ── USER (Agent) ────────────────────────────────────────────────
  if (req.actorType === "USER") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.actorId },
        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          username: true,
          isActive: true,
          availabilityStatus: true,
          createdAt: true,
          updatedAt: true,
          tenant: {
            select: {
              id: true,
              tenantName: true,
              status: true,
              isActive: true,
            },
          },
        },
      });

      if (!user) {
        return error(res, "Agent account not found", 404);
      }

      if (!user.isActive) {
        return error(res, "Your account has been deactivated", 403);
      }

      if (!user.tenant) {
        return error(res, "Your workspace no longer exists", 403);
      }

      if (user.tenant.status === "BLOCKED") {
        return error(
          res,
          "Your workspace has been blocked. Contact your admin.",
          403,
        );
      }

      if (!user.tenant.isActive) {
        return error(res, "Your workspace has been deactivated", 403);
      }

      if (user.tenant.status === "PENDING") {
        return error(res, "Your workspace is pending approval", 403);
      }

      req.user = user;
      req.userId = user.id;
      req.tenantId = user.tenantId;

      return next();
    } catch (err) {
      return error(res, "Failed to verify agent account", 500);
    }
  }

  // ── Neither ─────────────────────────────────────────────────────
  return error(res, "Access denied. Tenants and agents only.", 403);
};
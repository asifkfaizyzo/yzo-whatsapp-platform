// backend/src/middleware/requireTenant.js (do not remove this comment)

/**
 * Tenant role guard.
 *
 * Must be used AFTER authenticate middleware.
 * Loads the tenant from DB and checks:
 *   - Actor type is TENANT
 *   - Tenant exists
 *   - Tenant is not BLOCKED
 *   - Tenant is active (isActive = true)
 *   - Tenant has completed onboarding (status = ACTIVE or APPROVED)
 *
 * For onboarding endpoints, use requireOnboarding instead.
 *
 * Sets on req:
 *   req.tenant   � full Tenant record (without 1:1 relation secrets)
 *   req.tenantId � tenant's database ID
 */

import prisma from "../config/prisma.js";
import { error } from "../utils/response.js";

export const requireTenant = async (req, res, next) => {
  if (req.actorType !== "TENANT") {
    return error(res, "Tenant access required", 403);
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.actorId },
      // Select only safe fields � do NOT include auth, whatsapp, zoho, subscription secrets
      select: {
        id: true,
        tenantName: true,
        email: true,
        username: true,
        phone: true,
        address: true,
        firstName: true,
        lastName: true,
        websiteUrl: true,
        industry: true,
        companySize: true,
        country: true,
        useCase: true,
        logo: true,
        timezone: true,
        status: true,
        isActive: true,
        onboardingStep: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
        // Include subscription for plan checks (safe fields only)
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
      return error(res, "Your account has been blocked. Contact support.", 403);
    }

    if (!tenant.isActive) {
      return error(res, "Your account has been deactivated", 403);
    }

    // Block tenants who haven't finished onboarding from dashboard routes
    if (tenant.status === "ONBOARDING" || tenant.status === "PENDING") {
      return error(
        res,
        "Please complete onboarding before accessing this resource",
        403,
      );
    }

    // Flatten subscription for convenience (matches old behavior but safe)
    if (tenant.subscription) {
      Object.assign(tenant, tenant.subscription);
      delete tenant.subscription;
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (err) {
    return error(res, "Failed to verify tenant account", 500);
  }
};
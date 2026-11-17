// backend/src/middleware/requireSetupAccess.js (do not remove this comment)

/**
 * Setup access guard.
 *
 * Must be used AFTER authenticate middleware.
 * Allows tenants who are:
 *   - In ONBOARDING or PENDING status (normal onboarding flow), OR
 *   - Have completed onboarding but have missing setup fields (setup gate)
 *
 * This replaces requireOnboarding on auth routes so that legacy
 * tenants forced through the setup gate can access the same endpoints.
 *
 * Sets on req:
 *   req.tenant   — Tenant record (includes password hash for setup check)
 *   req.tenantId — tenant's database ID
 */

import prisma from "../config/prisma.js";
import { error } from "../utils/response.js";
import { getSetupStatus } from "../modules/tenant/auth/tenant.setup.service.js";

export const requireSetupAccess = async (req, res, next) => {
  if (req.actorType !== "TENANT") {
    return error(res, "Tenant access required", 403);
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.actorId },
      select: {
        id: true,
        tenantName: true,
        email: true,
        username: true,
        password: true,
        phone: true,
        address: true,
        firstName: true,
        lastName: true,
        websiteUrl: true,
        industry: true,
        companySize: true,
        country: true,
        useCase: true,
        status: true,
        isActive: true,
        onboardingStep: true,
        onboardingCompleted: true,
        isEmailVerified: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
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

    // Allow ONBOARDING and PENDING tenants (normal flow)
    if (tenant.status === "ONBOARDING" || tenant.status === "PENDING") {
      req.tenant = tenant;
      req.tenantId = tenant.id;
      return next();
    }

    // Allow completed tenants who have missing setup fields (gate)
    const setup = getSetupStatus(tenant);
    if (setup.required) {
      req.tenant = tenant;
      req.tenantId = tenant.id;
      return next();
    }

    return error(
      res,
      "Onboarding is already complete. Access the dashboard instead.",
      403,
    );
  } catch (err) {
    return error(res, "Failed to verify access", 500);
  }
};
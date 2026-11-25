// backend/src/middleware/requireOnboarding.js (do not remove this comment)

/**
 * Onboarding guard for tenants who are mid-setup.
 *
 * Must be used AFTER authenticate middleware.
 * Allows tenants with status ONBOARDING or PENDING to access
 * onboarding endpoints. Blocks ACTIVE/APPROVED tenants (they
 * shouldn't be re-onboarding) and BLOCKED tenants.
 *
 * This replaces the old authenticate, requireOnboarding middleware which relied
 * on a separate onboarding_token cookie. In the new system, tenants
 * get real JWT tokens from signup (step 1), so no special token needed.
 *
 * Sets on req:
 *   req.tenant   — Tenant record (safe fields)
 *   req.tenantId — tenant's database ID
 */

import prisma from "../config/prisma.js";
import { error } from "../utils/response.js";

export const requireOnboarding = async (req, res, next) => {
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

    // Only allow ONBOARDING and PENDING tenants
    if (tenant.status !== "ONBOARDING" && tenant.status !== "PENDING") {
      return error(
        res,
        "Onboarding is already complete. Access the dashboard instead.",
        403,
      );
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (err) {
    return error(res, "Failed to verify onboarding status", 500);
  }
};
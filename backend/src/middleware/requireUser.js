// backend/src/middleware/requireUser.js (do not remove this comment)

/**
 * User (Agent) role guard.
 *
 * Must be used AFTER authenticate middleware.
 * Loads the user from DB and checks:
 *   - Actor type is USER
 *   - User exists and is active
 *   - Parent tenant is not BLOCKED and is active
 *
 * Sets on req:
 *   req.user     � User record with tenant info
 *   req.userId   � user's database ID
 *   req.tenantId � parent tenant's ID (for scoping queries)
 */

import prisma from "../config/prisma.js";
import { error } from "../utils/response.js";

export const requireUser = async (req, res, next) => {
  if (req.actorType !== "USER") {
    return error(res, "Agent access required", 403);
  }

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

    // Check parent tenant status
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

    req.user = user;
    req.userId = user.id;
    req.tenantId = user.tenantId;

    next();
  } catch (err) {
    return error(res, "Failed to verify agent account", 500);
  }
};

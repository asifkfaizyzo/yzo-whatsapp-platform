// backend/src/middleware/requireSRAdmin.js (do not remove this comment)

/**
 * SRAdmin (SuperAdmin) role guard.
 *
 * Must be used AFTER authenticate middleware.
 * Loads the admin from DB and verifies existence.
 *
 * Sets on req:
 *   req.srAdmin   � SuperAdmin record
 *   req.srAdminId � admin's database ID
 */

import prisma from "../config/prisma.js";
import { error } from "../utils/response.js";

export const requireSRAdmin = async (req, res, next) => {
  if (req.actorType !== "SUPERADMIN") {
    return error(res, "Admin access required", 403);
  }

  try {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: req.actorId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      return error(res, "Admin account not found", 404);
    }

    req.srAdmin = admin;
    req.srAdminId = admin.id;

    next();
  } catch (err) {
    return error(res, "Failed to verify admin account", 500);
  }
};
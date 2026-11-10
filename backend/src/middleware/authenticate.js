// backend/src/middleware/authenticate.js (do not remove this comment)

/**
 * Unified JWT authentication middleware.
 *
 * Decodes the Bearer token and attaches actor identity to the request.
 * Does NOT load the full entity from the database — that's the job of
 * the role guard middleware (requireTenant, requireUser, requireSRAdmin).
 *
 * This separation means:
 * - authenticate is stateless and fast (no DB call)
 * - Guards load only the entity they need (no over-fetching)
 * - Fixes the old bug where verifyTenant flattened all 1:1 relations
 *   (including secrets like whatsappAccessToken) onto req.tenant
 *
 * Sets on req:
 *   req.actorId    — database ID
 *   req.actorType  — "TENANT" | "USER" | "SUPERADMIN"
 *   req.actorEmail — email from token payload
 */

import jwt from "jsonwebtoken";
import { error } from "../utils/response.js";

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return error(res, "Access token required", 401);
  }

  const token = header.split(" ")[1];

  if (!token) {
    return error(res, "Access token required", 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    if (!decoded.id || !decoded.type) {
      return error(res, "Invalid token payload", 401);
    }

    req.actorId = decoded.id;
    req.actorType = decoded.type;
    req.actorEmail = decoded.email || null;

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return error(res, "Access token expired", 401);
    }
    if (err.name === "JsonWebTokenError") {
      return error(res, "Invalid access token", 401);
    }
    return error(res, "Authentication failed", 401);
  }
};
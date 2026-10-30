import jwt from "jsonwebtoken";
import prisma from '../config/prisma.js';

export const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    if (decoded.type !== "USER") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Users only.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        isActive: true,
        availabilityStatus: true,   // ← NEW: needed for dashboard
        tenant: { select: { status: true, isActive: true } }
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    if (!user.tenant || user.tenant.status === 'BLOCKED' || !user.tenant.isActive) {
      return res.status(403).json({ success: false, message: "Tenant account is blocked or inactive" });
    }

    req.user = user;
    req.tenantId = user.tenantId;   // ← FIX: was missing, now consistent with verifyTenantOrUser
    req.userId = decoded.id;        // ← FIX: also add userId for consistency
    req.userType = "USER";

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
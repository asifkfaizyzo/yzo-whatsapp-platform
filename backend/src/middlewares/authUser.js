import jwt from "jsonwebtoken";
import prisma from '../config/prisma.js';

export const verifyUser = async (req, res, next) => {
  try {
    // 1️⃣ Get auth header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // 2️⃣ Extract token
    const token = authHeader.split(" ")[1];

    // 3️⃣ Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

     console.log("TOKEN TYPE:", decoded.type);

    // 4️⃣ Check user type
    if (decoded.type !== "USER") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Users only.",
      });
    }
   

    // 5️⃣ Fetch user from DB (optional but recommended)
    // 5️⃣ Fetch user from DB (IMPORTANT FIX)
const user = await prisma.user.findUnique({
  where: { id: decoded.id },
  select: {
    id: true,
    tenantId: true, // ✅ REQUIRED for your controller
    email: true,
    name: true,
    isActive: true,
    tenant: { select: { status: true, isActive: true } } // Fetch parent tenant
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

    // Ensure parent Tenant is active and approved
    if (!user.tenant || user.tenant.status === 'BLOCKED' || !user.tenant.isActive) {
      return res.status(403).json({ success: false, message: "Tenant account is blocked or inactive" });
    }

    // 6️⃣ Attach user to request
    req.user = user;

    req.userType = "USER";

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
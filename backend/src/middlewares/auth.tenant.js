// backend/src/middlewares/auth.tenant.js (do not remove this comment)
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const verifyTenant = async (req, res, next) => {
  try {
    // 1️⃣ Get authorization header
    const authHeader = req.headers.authorization;

    // 2️⃣ Check if token exists
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // 3️⃣ Extract token
    // "Bearer token_here"
    const token = authHeader.split(" ")[1];

    // 4️⃣ Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    // 5️⃣ Verify user type is TENANT
    if (decoded.type !== "TENANT") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Tenants only.",
      });
    }

    // 6️⃣ Fetch Tenant from Database to check status
    const tenantRow = await prisma.tenant.findUnique({
      where: { id: decoded.id },
      include: {
        auth: true,
        whatsapp: true,
        social: true,
        zoho: true,
        subscription: true,
      },
    });

    if (!tenantRow) {
      return res.status(401).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (tenantRow.status === "BLOCKED" || !tenantRow.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your account is blocked or deactivated.",
      });
    }

    // 7️⃣ Flatten 1:1 tables so req.tenant.whatsappPhoneId etc. still works
    const tenant = {
      ...tenantRow,
      ...tenantRow.auth,
      ...tenantRow.whatsapp,
      ...tenantRow.social,
      ...tenantRow.zoho,
      ...tenantRow.subscription,
    };

    req.tenant = tenant;
    req.tenantId = tenant.id;
    req.userType = "TENANT";

    // 8️⃣ Go to next function
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Middleware to ensure the tenant's account has been approved by a super admin
export const requireApprovedTenant = async (req, res, next) => {
  const tenant = req.tenant; // Already fetched by verifyTenant

  if (!tenant || tenant.status !== "APPROVED") {
    return res.status(403).json({
      success: false,
      message:
        "Action forbidden. Your tenant account is pending approval or blocked.",
    });
  }

  next();
};

// Middleware to verify active onboarding session cookie
export const verifyOnboarding = async (req, res, next) => {
  try {
    let tenantId;

    // 1. Check if onboarding_token cookie exists
    const onboardingToken = req.cookies?.onboarding_token;

    if (onboardingToken) {
      try {
        const decoded = jwt.verify(onboardingToken, process.env.ACCESS_SECRET);
        if (decoded.type === "TENANT_ONBOARDING" || decoded.type === "TENANT") {
          tenantId = decoded.id;
        }
      } catch (err) {
        // Fall through to other auth methods
      }
    }

    // 2. Fallback: Check if authenticated via Bearer Access Token (e.g. Google Signup)
    if (!tenantId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const accessToken = authHeader.split(" ")[1];
          const decodedAccess = jwt.verify(
            accessToken,
            process.env.ACCESS_SECRET,
          );
          if (
            decodedAccess.type === "TENANT" ||
            decodedAccess.type === "TENANT_ONBOARDING"
          ) {
            tenantId = decodedAccess.id;
          }
        } catch (err) {
          // Fall through
        }
      }
    }

    // 3. Fallback: Check if tenant_refresh_token cookie exists
    if (!tenantId && req.cookies?.tenant_refresh_token) {
      try {
        const decodedRefresh = jwt.verify(
          req.cookies.tenant_refresh_token,
          process.env.REFRESH_SECRET,
        );
        if (decodedRefresh.type === "TENANT") {
          tenantId = decodedRefresh.id;
        }
      } catch (err) {
        // Fall through
      }
    }

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message:
          "Onboarding session expired or unauthorized. Please start over or log in.",
      });
    }

    const tenantRow = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        auth: true,
        whatsapp: true,
        social: true,
        zoho: true,
        subscription: true,
      },
    });

    if (!tenantRow) {
      return res.status(401).json({
        success: false,
        message: "Tenant workspace not found.",
      });
    }

    // Flatten so planId and planStatus resolve from subscription
    const tenant = {
      ...tenantRow,
      ...tenantRow.auth,
      ...tenantRow.whatsapp,
      ...tenantRow.social,
      ...tenantRow.zoho,
      ...tenantRow.subscription,
    };

    if (
      tenant.onboardingCompleted &&
      tenant.planId &&
      tenant.planStatus === "active"
    ) {
      return res.status(400).json({
        success: false,
        message: "Onboarding already completed. Please log in normally.",
      });
    }

    // Inject tenant info
    req.tenantId = tenant.id;
    req.tenant = tenant;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired onboarding session.",
    });
  }
};

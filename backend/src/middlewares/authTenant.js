import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const verifyTenant =
  async (req, res, next) => {

    try {

      // 1️⃣ Get authorization header
      const authHeader =
        req.headers.authorization;

      // 2️⃣ Check if token exists
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message:
            'Access token required',
        });
      }

      // 3️⃣ Extract token
      // "Bearer token_here"
      const token =
        authHeader.split(' ')[1];

      // 4️⃣ Verify token
      const decoded = jwt.verify(
        token,
        process.env.ACCESS_SECRET
      );

      // 5️⃣ Verify user type is TENANT
      if (decoded.type !== 'TENANT') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Tenants only.',
        });
      }

      // 6️⃣ Fetch Tenant from Database to check status
      const tenant = await prisma.tenant.findUnique({
        where: { id: decoded.id },
      });

      if (!tenant) {
        return res.status(401).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      if (tenant.status === 'BLOCKED' || !tenant.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Your account is blocked or deactivated.',
        });
      }

      // 7️⃣ Save full tenant info
      req.tenant = tenant;
      req.tenantId = tenant.id;
      req.userType = 'TENANT';

      // 8️⃣ Go to next function
      next();

    } catch (error) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid or expired token',
      });

    }
};


// Middleware to ensure the tenant's account has been approved by a super admin
export const requireApprovedTenant = async (req, res, next) => {
  const tenant = req.tenant; // Already fetched by verifyTenant

  if (!tenant || tenant.status !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      message: 'Action forbidden. Your tenant account is pending approval or blocked.',
    });
  }

  next();
};

// Middleware to verify active onboarding session cookie
export const verifyOnboarding = async (req, res, next) => {
  try {
    let tenantId;
    
    // Check if onboarding_token cookie exists
    const onboardingToken = req.cookies.onboarding_token;
    
    if (onboardingToken) {
      const decoded = jwt.verify(onboardingToken, process.env.ACCESS_SECRET);
      if (decoded.type !== 'TENANT_ONBOARDING') {
        return res.status(401).json({ success: false, message: 'Invalid onboarding session.' });
      }
      tenantId = decoded.id;
    } else {
      // Fallback: Check if they are authenticated via standard Access Token (e.g. Google Signup)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.split(' ')[1];
        const decodedAccess = jwt.verify(accessToken, process.env.ACCESS_SECRET);
        if (decodedAccess.type === 'TENANT') {
          tenantId = decodedAccess.id;
        }
      }
    }

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Onboarding session expired or unauthorized. Please start over or log in.',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Tenant workspace not found.',
      });
    }

    if (tenant.onboardingCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding already completed. Please log in normally.',
      });
    }

    // Inject tenant info
    req.tenantId = tenant.id;
    req.tenant = tenant;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired onboarding session.',
    });
  }
};

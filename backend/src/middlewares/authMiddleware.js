// middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';


// ===================== SUPERADMIN =====================
export const verifySuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    //Check token type
    if (decoded.type !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. SuperAdmins only.',
      });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.id },
    });

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: 'SuperAdmin not found',
      });
    }

    req.superAdmin = superAdmin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};



// ===================== TENANT =====================
export const verifyTenant = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    //check token type
    if (decoded.type !== 'TENANT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenants only.',
      });
    }


    const tenant = await prisma.tenant.findUnique({
      where: { id: decoded.id },
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    req.userType = 'TENANT';
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};



// ===================== USER (Agent/Admin) =====================
export const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    //check token type
    if (decoded.type !== 'USER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Users only.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated',
      });
    }

    req.user = user;
    req.tenantId = user.tenantId;     // Very important for multi-tenant isolation
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

// Optional: Check if user is Admin
// ✅ NEW
export const isAdmin = (req, res, next) => {
  if (req.user || req.tenant) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Admin only.',
  });
};
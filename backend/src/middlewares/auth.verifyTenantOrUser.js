// backend/src/middlewares/auth.verifyTenantOrUser.js (do not remove this comment)
//backend\src\middlewares\auth.verifyTenantOrUser.js
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const verifyTenantOrUser = async (req, res, next) => {
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

    // ===================== TENANT =====================
    if (decoded.type === 'TENANT') {
      const tenantRow = await prisma.tenant.findUnique({
        where: { id: decoded.id },
        include: { auth: true, whatsapp: true, social: true, zoho: true, subscription: true },
      });

      if (!tenantRow) {
        return res.status(401).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      if (!tenantRow.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is deactivated',
        });
      }

      if (tenantRow.status === 'PENDING') {
        const isPaymentRoute =
          req.originalUrl.includes('/plans/create-order') ||
          req.originalUrl.includes('/plans/verify-payment') ||
          req.originalUrl.includes('/plans/public');

        if (!isPaymentRoute) {
          return res.status(403).json({
            success: false,
            message: 'Your account is pending approval',
          });
        }
      }

      if (tenantRow.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          message: 'Your account is blocked',
        });
      }

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
      req.userType = 'TENANT';

      return next();
    }

    // ===================== USER =====================
    if (decoded.type === 'USER') {
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

      const tenantRow = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { auth: true, whatsapp: true, social: true, zoho: true, subscription: true },
      });

      if (!tenantRow) {
        return res.status(401).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      if (!tenantRow.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is deactivated',
        });
      }

      if (tenantRow.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is pending approval',
        });
      }

      if (tenantRow.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is blocked',
        });
      }

      req.user = user;
      req.tenantId = user.tenantId;
      req.userType = 'USER';
      req.userId   = decoded.id;

      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. Tenants and Users only.',
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};
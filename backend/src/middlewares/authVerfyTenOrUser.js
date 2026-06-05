import jwt from 'jsonwebtoken';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

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
      const tenant = await prisma.tenant.findUnique({
        where: { id: decoded.id },
      });

      if (!tenant) {
        return res.status(401).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      if (!tenant.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is deactivated',
        });
      }

      if (tenant.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending approval',
        });
      }

      if (tenant.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          message: 'Your account is blocked',
        });
      }

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

      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
      });

      if (!tenant) {
        return res.status(401).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      if (!tenant.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is deactivated',
        });
      }

      if (tenant.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is pending approval',
        });
      }

      if (tenant.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is blocked',
        });
      }

      req.user = user;
      req.tenantId = user.tenantId;
      req.userType = 'USER';

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
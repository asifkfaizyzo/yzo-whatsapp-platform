// middlewares/verifyTenant.js

import jwt from 'jsonwebtoken';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

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

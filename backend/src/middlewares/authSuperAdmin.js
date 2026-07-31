import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const verifySuperAdmin =
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

      // 5️⃣ Verify user type is SUPERADMIN
      if (decoded.type !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. SuperAdmins only.',
        });
      }

    // 6️⃣ Fetch SuperAdmin from Database to verify active status
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.id },
    });

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: 'SuperAdmin account not found or revoked',
      });
    }

    // 7️⃣ Save verified user info to request
    req.superAdmin = superAdmin;
    req.superAdminId = superAdmin.id;

    next();

    } catch (error) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid or expired token',
      });

    }
  };
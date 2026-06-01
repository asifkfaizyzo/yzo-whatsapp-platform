import jwt from 'jsonwebtoken';

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

      // 5️⃣ Save decoded user info
      req.superAdmin = decoded;

      // 6️⃣ Go to next function
      next();

    } catch (error) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid or expired token',
      });

    }
  };
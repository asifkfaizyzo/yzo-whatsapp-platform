import crypto from 'crypto';

/**
 * HTTP Basic Authentication middleware for Bull Board Dashboard.
 * Uses SHA-256 constant-time comparison to prevent timing attacks.
 */
export const bullBoardAuth = (req, res, next) => {
  const user = process.env.BULL_BOARD_USERNAME || 'admin';
  const pass = process.env.BULL_BOARD_PASSWORD;

  // In production, require password to be configured
  if (!pass) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ BULL_BOARD_PASSWORD is not configured in production environment variables.');
      return res.status(503).send('Dashboard access is disabled. Set BULL_BOARD_PASSWORD in .env.');
    }
    // Allow without password in local development only
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Dashboard"');
    return res.status(401).send('Authentication required');
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Dashboard"');
      return res.status(401).send('Invalid credentials format');
    }

    const inputUser = credentials.substring(0, colonIndex);
    const inputPass = credentials.substring(colonIndex + 1);

    // Hash inputs to 32-byte SHA-256 digests before timingSafeEqual to avoid length leakage and RangeErrors
    const inputUserHash = crypto.createHash('sha256').update(inputUser).digest();
    const targetUserHash = crypto.createHash('sha256').update(user).digest();
    const inputPassHash = crypto.createHash('sha256').update(inputPass).digest();
    const targetPassHash = crypto.createHash('sha256').update(pass).digest();

    const userMatch = crypto.timingSafeEqual(inputUserHash, targetUserHash);
    const passMatch = crypto.timingSafeEqual(inputPassHash, targetPassHash);

    if (userMatch && passMatch) {
      return next();
    }
  } catch (err) {
    // Malformed credentials or decoding error
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Dashboard"');
  return res.status(401).send('Invalid credentials');
};

// Extracts IP address and browser info from request
export const extractRequestMeta = (req) => ({
  ipAddress: 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.ip
    || req.connection?.remoteAddress
    || null,

  userAgent: req.headers['user-agent'] || null,
});
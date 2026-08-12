import prisma from '../config/prisma.js';

const ALLOWED_EXPIRED_ROUTES = [
  '/api/billing',
  '/api2/billing',
  '/api/plans',
  '/api2/plans',
  '/api/account/profile',
  '/api2/account/profile',
  '/api/support',
  '/api2/support',
  '/api2/me'
];

export const checkSubscriptionAccess = async (req, res, next) => {
  if (!req.tenantId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        subscriptionStatus: true,
        planPeriodEnd: true,
        dataDeletionDate: true
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found"
      });
    }

    let status = tenant.subscriptionStatus;

    // Self-healing: if cancelled plan has reached its period end, expire it immediately
    if (status === 'cancel_at_period_end' && tenant.planPeriodEnd && new Date(tenant.planPeriodEnd) < new Date()) {
      const computedDeletionDate = new Date();
      computedDeletionDate.setDate(computedDeletionDate.getDate() + 90);

      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: {
          subscriptionStatus: 'expired',
          planStatus: 'inactive',
          dataDeletionDate: computedDeletionDate
        }
      });
      status = 'expired';
    }

    if (
      status === 'active' || 
      status === 'cancel_at_period_end' ||
      status === 'trialing'
    ) {
      return next();
    }

    if (status === 'expired') {
      const fullPath = req.originalUrl;
      const isAllowed = ALLOWED_EXPIRED_ROUTES.some(route => fullPath.startsWith(route)) ||
                        fullPath.includes('/billing/invoices/') ||
                        fullPath.includes('/plans/billing');

      if (isAllowed) return next();

      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: "Your subscription has expired.",
        redirect: '/plans'
      });
    }

    if (status === 'paused') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_PAUSED',
        message: "Your account is paused. Contact support.",
        redirect: '/support'
      });
    }

    // Deny by default — any unknown or null status does NOT get access
    console.warn(`[checkSubscriptionAccess] Unknown subscription status "${status}" for tenant ${req.tenantId}. Denying access.`);
    return res.status(403).json({
      success: false,
      code: 'SUBSCRIPTION_UNKNOWN',
      message: 'Your account does not have an active subscription.',
      redirect: '/plans'
    });
  } catch (error) {
    console.error("Subscription access middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
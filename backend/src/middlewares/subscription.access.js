// backend/src/middlewares/subscription.access.js (do not remove this comment)
import prisma from "../config/prisma.js";

const ALLOWED_EXPIRED_ROUTES = [
  "/sradmin/billing",
  "/tenant/billing",
  "/sradmin/plans",
  "/tenant/plans",
  "/sradmin/account/profile",
  "/tenant/account/profile",
  "/sradmin/support",
  "/tenant/support",
  "/tenant/me",
  "/tenant/user/me",
  "/sradmin/webhook",
  "/tenant/webhook",
  "/tenant/checkout",
  "/sradmin/checkout",
];

export const checkSubscriptionAccess = async (req, res, next) => {
  if (!req.tenantId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const tenantRow = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        email: true,
        tenantName: true,
        createdAt: true,
        subscription: {
          select: {
            subscriptionStatus: true,
            planPeriodEnd: true,
            razorpaySubscriptionId: true,
            planStatus: true,
            dataDeletionDate: true,
          },
        },
      },
    });

    if (!tenantRow) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const tenant = { ...tenantRow, ...tenantRow.subscription };
    let status = tenant.subscriptionStatus;
    const now = new Date();

    // 1. Trial Expiration Check (with Synchronized 24h Grace Window for Autopay)
    if (status === "trialing") {
      const trialEnd =
        tenant.planPeriodEnd ||
        new Date(new Date(tenant.createdAt).getTime() + 14 * 86400000);

      if (trialEnd < now) {
        // If Autopay is active, allow 24h grace window for webhook renewal processing
        if (tenant.razorpaySubscriptionId) {
          const gracePeriodEnd = new Date(trialEnd.getTime() + 24 * 3600000);
          if (now < gracePeriodEnd) {
            return next(); // In grace window, allow request through
          }
        }

        // Grace window expired or no autopay -> self-heal expire atomically
        await prisma.tenantSubscription.updateMany({
          where: {
            tenantId: tenant.id,
            subscriptionStatus: "trialing",
            planPeriodEnd: { lt: now },
          },
          data: {
            subscriptionStatus: "expired",
            planStatus: "inactive",
            dataDeletionDate: new Date(now.getTime() + 90 * 86400000),
          },
        });
        status = "expired";
      }
    }

    // 2. Cancel at Period End Expiration Check
    if (
      status === "cancel_at_period_end" &&
      tenant.planPeriodEnd &&
      new Date(tenant.planPeriodEnd) < now
    ) {
      await prisma.tenantSubscription.updateMany({
        where: {
          tenantId: tenant.id,
          subscriptionStatus: "cancel_at_period_end",
          planPeriodEnd: { lt: now },
        },
        data: {
          subscriptionStatus: "expired",
          planStatus: "inactive",
          dataDeletionDate: new Date(now.getTime() + 90 * 86400000),
        },
      });
      status = "expired";
    }

    if (
      status === "active" ||
      status === "trialing" ||
      status === "cancel_at_period_end"
    ) {
      return next();
    }

    if (status === "payment_failed") {
      const fullPath = req.originalUrl;
      const isAllowed =
        ALLOWED_EXPIRED_ROUTES.some((route) => fullPath.startsWith(route)) ||
        fullPath.includes("/billing/invoices/") ||
        fullPath.includes("/plans/billing");

      if (isAllowed) return next();

      return res.status(403).json({
        success: false,
        code: "PAYMENT_FAILED",
        message:
          "Your recent subscription renewal payment failed. Please update your payment method to continue.",
        redirect: "/billing",
      });
    }

    if (status === "expired") {
      const fullPath = req.originalUrl;
      const isAllowed =
        ALLOWED_EXPIRED_ROUTES.some((route) => fullPath.startsWith(route)) ||
        fullPath.includes("/billing/invoices/") ||
        fullPath.includes("/plans/billing");

      if (isAllowed) return next();

      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        message:
          "Your subscription/trial has expired. Please select a plan to continue.",
        redirect: "/plans",
      });
    }

    if (status === "paused") {
      // Allow all read-only GET requests (Analytics, Dashboard, Contacts, Templates, Flows, Settings, etc.)
      if (req.method === "GET") {
        return next();
      }

      // Allow subscription management and billing routes
      const fullPath = req.originalUrl;
      const isAllowed =
        ALLOWED_EXPIRED_ROUTES.some((route) => fullPath.startsWith(route)) ||
        fullPath.includes("/billing") ||
        fullPath.includes("/plans");

      if (isAllowed) return next();

      // Block active outbound write/send actions while paused
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_PAUSED",
        message:
          "Your subscription is currently paused. Please resume your plan from Billing to perform this action.",
        redirect: "/dashboard/billing",
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
      message: "Internal server error",
    });
  }
};

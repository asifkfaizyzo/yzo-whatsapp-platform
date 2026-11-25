// backend/src/middleware/subscriptionAccess.js (do not remove this comment)
import prisma from "../config/prisma.js";
import { getInvoiceSettings } from "../lib/invoice.js";

const DAY_MS = 86_400_000;

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

const isAllowedBillingOrProfileRoute = (fullPath = "") =>
  ALLOWED_EXPIRED_ROUTES.some((route) => fullPath.startsWith(route)) ||
  fullPath.includes("/billing/invoices/") ||
  fullPath.includes("/plans/billing");

const computeRetentionDeletionDate = async (lastPaymentDate, now) => {
  const settings = await getInvoiceSettings().catch(() => null);
  const retentionDays = lastPaymentDate
    ? Number(settings?.paidRetentionDays) || 90
    : Number(settings?.trialRetentionDays) || 7;
  return new Date(now.getTime() + retentionDays * DAY_MS);
};

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
            gracePeriodEnd: true,
            freeUntilDate: true,
            lastPaymentDate: true,
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

    const sub = tenantRow.subscription || {};
    let status = sub.subscriptionStatus || "inactive";
    const now = new Date();

    // 0. Free-Until Override (grants full operational access unless admin-paused)
    if (
      status !== "paused" &&
      sub.freeUntilDate &&
      new Date(sub.freeUntilDate) > now
    ) {
      return next();
    }

    // 1. Trial Expiration Check (with 24h buffer for Autopay webhook arrival)
    if (status === "trialing") {
      const trialEnd = sub.planPeriodEnd
        ? new Date(sub.planPeriodEnd)
        : new Date(new Date(tenantRow.createdAt).getTime() + 14 * DAY_MS);

      if (trialEnd < now) {
        if (sub.razorpaySubscriptionId) {
          const autopayBufferEnd = new Date(
            trialEnd.getTime() + 24 * 3_600_000,
          );
          if (now < autopayBufferEnd) {
            return next();
          }
        }

        const dataDeletionDate = await computeRetentionDeletionDate(
          sub.lastPaymentDate,
          now,
        );

        await prisma.$transaction([
          prisma.tenantSubscription.updateMany({
            where: {
              tenantId: tenantRow.id,
              subscriptionStatus: "trialing",
              planPeriodEnd: { lt: now },
            },
            data: {
              subscriptionStatus: "expired",
              dataDeletionDate,
            },
          }),
          prisma.tenantAddOn.updateMany({
            where: {
              tenantId: tenantRow.id,
              status: "active",
            },
            data: {
              status: "cancel_at_period_end",
              cancelledAt: now,
            },
          }),
        ]);
        status = "expired";
      }
    }

    // 2. Cancel-at-Period-End Expiration Check
    if (
      status === "cancel_at_period_end" &&
      sub.planPeriodEnd &&
      new Date(sub.planPeriodEnd) < now
    ) {
      const dataDeletionDate = await computeRetentionDeletionDate(
        sub.lastPaymentDate,
        now,
      );

      await prisma.$transaction([
        prisma.tenantSubscription.updateMany({
          where: {
            tenantId: tenantRow.id,
            subscriptionStatus: "cancel_at_period_end",
            planPeriodEnd: { lt: now },
          },
          data: {
            subscriptionStatus: "expired",
            dataDeletionDate,
          },
        }),
        prisma.tenantAddOn.updateMany({
          where: {
            tenantId: tenantRow.id,
            status: "active",
          },
          data: {
            status: "cancel_at_period_end",
            cancelledAt: now,
          },
        }),
      ]);
      status = "expired";
    }

    // 3. Standard Active Operational Statuses
    if (
      status === "active" ||
      status === "trialing" ||
      status === "cancel_at_period_end"
    ) {
      return next();
    }

    // 4. Grace Period (payment_failed with active gracePeriodEnd)
    if (status === "payment_failed") {
      if (sub.gracePeriodEnd && new Date(sub.gracePeriodEnd) > now) {
        req.inGracePeriod = true;
        req.gracePeriodEnd = sub.gracePeriodEnd;
        return next();
      }

      if (isAllowedBillingOrProfileRoute(req.originalUrl)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        code: "PAYMENT_FAILED",
        message:
          "Your recent subscription renewal payment failed and your grace period has ended. Please update your payment method or renew your plan to continue.",
        redirect: "/billing",
      });
    }

    // 5. Expired Subscription
    if (status === "expired") {
      if (isAllowedBillingOrProfileRoute(req.originalUrl)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        message:
          "Your subscription/trial has expired. Please select a plan to continue.",
        redirect: "/plans",
      });
    }

    // 6. Paused Subscription (read-only GET allowed; writes blocked except billing/plans)
    if (status === "paused") {
      if (req.method === "GET") {
        return next();
      }

      const fullPath = req.originalUrl || "";
      if (
        isAllowedBillingOrProfileRoute(fullPath) ||
        fullPath.includes("/billing") ||
        fullPath.includes("/plans")
      ) {
        return next();
      }

      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_PAUSED",
        message:
          "Your subscription is currently paused. Please resume your plan from Billing to perform this action.",
        redirect: "/dashboard/billing",
      });
    }

    // 7. Inactive / None / Unknown -> allow billing & plan selection routes, deny others
    if (isAllowedBillingOrProfileRoute(req.originalUrl)) {
      return next();
    }

    console.warn(
      `[checkSubscriptionAccess] Non-active subscription status "${status}" for tenant ${req.tenantId}. Denying access.`,
    );
    return res.status(403).json({
      success: false,
      code: "SUBSCRIPTION_UNKNOWN",
      message: "Your account does not have an active subscription.",
      redirect: "/plans",
    });
  } catch (error) {
    console.error("Subscription access middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

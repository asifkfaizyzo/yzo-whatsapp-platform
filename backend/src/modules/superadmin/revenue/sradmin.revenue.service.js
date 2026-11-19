// backend/src/modules/superadmin/revenue/sradmin.revenue.service.js (do not remove this comment)

import prisma from "../../../config/prisma.js";
import { NotFoundError } from "../../../utils/error.js";

/**
 * Normalizes a subscription's recurring contribution to monthly equivalent (MRR).
 */
const computeSubscriptionMrr = (sub) => {
  if (!sub || sub.isFreeTrial || sub.isComplimentary || !sub.plan) return 0;

  const cycle = sub.billingCycle || "MONTHLY";
  if (cycle === "ANNUAL") {
    const annual = Number(sub.plan.annualPrice ?? 0);
    return annual > 0
      ? Math.round(annual / 12)
      : Number(sub.plan.monthlyPrice ?? 0);
  }
  if (cycle === "QUARTERLY") {
    const quarterly = Number(sub.plan.quarterlyPrice ?? 0);
    return quarterly > 0
      ? Math.round(quarterly / 3)
      : Number(sub.plan.monthlyPrice ?? 0);
  }
  return Number(sub.plan.monthlyPrice ?? 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. PLATFORM REVENUE STATS (Dashboard summary widget)
// ─────────────────────────────────────────────────────────────────────────────
export const getPlatformRevenueStatsService = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalAgg, monthlyAgg, activePlans] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),
    prisma.subscription.count({
      where: {
        subscriptionStatus: { in: ["active", "payment_failed"] },
        isFreeTrial: false,
        isComplimentary: false,
      },
    }),
  ]);

  const totalRevenue = Number(totalAgg._sum.totalAmount || 0);
  const monthlyRevenue = Number(monthlyAgg._sum.totalAmount || 0);
  const arpu = activePlans > 0 ? Math.round(monthlyRevenue / activePlans) : 0;

  return {
    totalRevenue,
    monthlyRevenue,
    activePlans,
    arpu,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DETAILED REVENUE STATS (Revenue analytics page)
// ─────────────────────────────────────────────────────────────────────────────
export const getRevenueStatsService = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalPaidAgg,
    monthlyPaidAgg,
    pendingInvoicesAgg,
    voidOrRefundedCount,
    activeSubs,
    cancelledThisMonthCount,
    totalSubsCount,
    plans,
    recentPaidInvoices,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["ISSUED", "DRAFT"] } },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.count({
      where: { status: { in: ["VOID", "REFUNDED"] } },
    }),
    prisma.subscription.findMany({
      where: {
        subscriptionStatus: { in: ["active", "payment_failed"] },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            monthlyPrice: true,
            quarterlyPrice: true,
            annualPrice: true,
          },
        },
      },
    }),
    prisma.subscription.count({
      where: {
        subscriptionStatus: { in: ["cancelled", "expired"] },
        updatedAt: { gte: startOfMonth },
      },
    }),
    prisma.subscription.count(),
    prisma.plan.findMany({
      where: { status: { not: "DISCONTINUED" } },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: sixMonthsAgo },
      },
      select: {
        totalAmount: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);

  const totalConfirmed = Number(totalPaidAgg._sum.totalAmount || 0);
  const monthlyConfirmed = Number(monthlyPaidAgg._sum.totalAmount || 0);
  const pendingInvoicesAmount = Number(
    pendingInvoicesAgg._sum.totalAmount || 0,
  );

  const payingSubs = activeSubs.filter(
    (s) => !s.isFreeTrial && !s.isComplimentary,
  );
  const activeSubsCount = payingSubs.length;

  const mrr = payingSubs.reduce(
    (sum, sub) => sum + computeSubscriptionMrr(sub),
    0,
  );
  const arr = mrr * 12;
  const arpu = activeSubsCount > 0 ? Math.round(mrr / activeSubsCount) : 0;

  const churnRate =
    totalSubsCount > 0
      ? Number(((cancelledThisMonthCount / totalSubsCount) * 100).toFixed(1))
      : 0;

  const planDistribution = plans.map((p) => ({
    id: p.id,
    name: p.name,
    count: p._count.subscriptions,
    monthlyPrice: Number(p.monthlyPrice || 0),
  }));

  // Build 6-month revenue series
  const monthBuckets = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    monthBuckets.set(key, { month: label, revenue: 0 });
  }

  for (const inv of recentPaidInvoices) {
    const dt = inv.paidAt || inv.createdAt;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (monthBuckets.has(key)) {
      monthBuckets.get(key).revenue += Number(inv.totalAmount || 0);
    }
  }

  return {
    totalConfirmed,
    monthlyConfirmed,
    pendingInvoicesAmount,
    failedPaymentsCount: voidOrRefundedCount,
    activeSubsCount,
    arpu,
    mrr,
    arr,
    churnRate,
    planDistribution,
    revenueByMonth: Array.from(monthBuckets.values()),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAGINATED REVENUE PAYMENTS / INVOICES LEDGER
// ─────────────────────────────────────────────────────────────────────────────
export const getRevenuePaymentsService = async ({
  page = 1,
  limit = 20,
  search = "",
  status = "",
}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (status && status !== "all") {
    const normalized = String(status).toUpperCase();
    if (normalized === "PAID" || normalized === "CAPTURED") {
      where.status = "PAID";
    } else if (normalized === "PENDING" || normalized === "ISSUED") {
      where.status = { in: ["ISSUED", "DRAFT"] };
    } else if (
      normalized === "FAILED" ||
      normalized === "VOID" ||
      normalized === "REFUNDED"
    ) {
      where.status = { in: ["VOID", "REFUNDED"] };
    } else {
      where.status = normalized;
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { planName: { contains: q, mode: "insensitive" } },
      { razorpayPaymentId: { contains: q, mode: "insensitive" } },
      { tenant: { tenantName: { contains: q, mode: "insensitive" } } },
      { tenant: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        tenant: {
          select: {
            id: true,
            tenantName: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const payments = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceType: inv.invoiceType,
    tenantId: inv.tenantId,
    tenantName: inv.tenant?.tenantName || inv.buyerName || "Unknown Tenant",
    tenantEmail: inv.tenant?.email || inv.buyerEmail || "",
    planName: inv.planName || "Plan / Add-On",
    billingType: inv.billingCycle || "MONTHLY",
    billingCycle: inv.billingCycle || "MONTHLY",
    baseAmount: Number(inv.subtotalAmount || 0),
    discountAmount: Number(inv.discountAmount || 0),
    gstAmount: Number(inv.taxAmount || 0),
    amount: Number(inv.totalAmount || 0),
    status: inv.status.toLowerCase(),
    paymentMethod:
      inv.paymentGateway || (inv.razorpayPaymentId ? "razorpay" : "offline"),
    razorpayPaymentId: inv.razorpayPaymentId,
    razorpayOrderId: inv.razorpayOrderId,
    invoiceUrl: inv.pdfUrl,
    paidAt: inv.paidAt || inv.createdAt,
    createdAt: inv.createdAt,
  }));

  return {
    payments,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. TENANT BILLING DETAIL (SuperAdmin tenant drawer / detail view)
// ─────────────────────────────────────────────────────────────────────────────
export const getTenantBillingDetailService = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      tenantName: true,
      email: true,
      phone: true,
      status: true,
      isActive: true,
      createdAt: true,
      subscription: {
        include: {
          plan: true,
          pendingPlan: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
      addOns: {
        include: { addOn: true },
        orderBy: { createdAt: "desc" },
      },
      creditPools: true,
    },
  });

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const sub = tenant.subscription;

  const payments = tenant.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceType: inv.invoiceType,
    planName: inv.planName || sub?.plan?.name || "Subscription",
    billingType: inv.billingCycle || sub?.billingCycle || "MONTHLY",
    billingCycle: inv.billingCycle || sub?.billingCycle || "MONTHLY",
    baseAmount: Number(inv.subtotalAmount || 0),
    discountAmount: Number(inv.discountAmount || 0),
    gstAmount: Number(inv.taxAmount || 0),
    amount: Number(inv.totalAmount || 0),
    status: inv.status.toLowerCase(),
    paymentMethod:
      inv.paymentGateway || (inv.razorpayPaymentId ? "razorpay" : "offline"),
    razorpayPaymentId: inv.razorpayPaymentId,
    razorpayOrderId: inv.razorpayOrderId,
    invoiceUrl: inv.pdfUrl,
    paidAt: inv.paidAt || inv.createdAt,
    createdAt: inv.createdAt,
  }));

  const totalSpent = tenant.invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);

  return {
    tenant: {
      id: tenant.id,
      tenantName: tenant.tenantName,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
    },
    subscription: sub
      ? {
          id: sub.id,
          planId: sub.planId,
          planName: sub.plan?.name || "Unassigned",
          planSlug: sub.plan?.slug || null,
          subscriptionStatus: sub.subscriptionStatus,
          billingCycle: sub.billingCycle,
          isFreeTrial: sub.isFreeTrial,
          isComplimentary: sub.isComplimentary,
          complimentaryReason: sub.complimentaryReason,
          planActivatedAt: sub.planActivatedAt,
          planPeriodStart: sub.planPeriodStart,
          planPeriodEnd: sub.planPeriodEnd,
          gracePeriodEnd: sub.gracePeriodEnd,
          graceDaysGranted: sub.graceDaysGranted,
          graceDebtDays: sub.graceDebtDays,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          cancelRequestedAt: sub.cancelRequestedAt,
          cancellationReason: sub.cancellationReason,
          pendingPlanId: sub.pendingPlanId,
          pendingPlanName: sub.pendingPlan?.name || null,
          pendingBillingCycle: sub.pendingBillingCycle,
          dataDeletionDate: sub.dataDeletionDate,
          customLimitsOverride: sub.customLimitsOverride,
          adminNotes: sub.adminNotes,
        }
      : null,
    totalSpent,
    payments,
    invoices: tenant.invoices,
    addOns: tenant.addOns,
    creditPools: tenant.creditPools,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET INVOICE PDF URL BY INVOICE ID
// ─────────────────────────────────────────────────────────────────────────────
export const getInvoiceUrlService = async (paymentId) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      invoiceNumber: true,
      pdfUrl: true,
    },
  });

  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceUrl: invoice.pdfUrl,
  };
};

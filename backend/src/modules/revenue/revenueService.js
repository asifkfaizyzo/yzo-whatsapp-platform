// backend/src/modules/revenue/revenueService.js

import prisma from "../../config/prisma.js";

// ── Dashboard Card Stats ──
export const getPlatformRevenueStatsService = async () => {
  const allPayments = await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    select: { totalAmount: true, paidAt: true },
  });

  const now              = new Date();
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthRevenue = allPayments
    .filter((p) => new Date(p.paidAt) >= startOfMonth)
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  const lastMonthRevenue = allPayments
    .filter((p) => {
      const d = new Date(p.paidAt);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    })
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  let growthPercent = 0;
  if (lastMonthRevenue > 0) {
    growthPercent = parseFloat(
      (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
    );
  } else if (thisMonthRevenue > 0) {
    growthPercent = 100;
  }

  return {
    thisMonthRevenue: parseFloat(thisMonthRevenue.toFixed(2)),
    lastMonthRevenue: parseFloat(lastMonthRevenue.toFixed(2)),
    growthPercent,
  };
};


// ── Revenue Page Full Stats ──
export const getRevenueStatsService = async () => {
  const allPayments = await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    select: {
      totalAmount: true,
      baseAmount: true,
      gstAmount: true,
      billingType: true,
      planName: true,
      planId: true,
      paidAt: true,
      tenantId: true,
    },
  });

  const now              = new Date();
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0);

  // ── Total Revenue ──
  const totalRevenue = allPayments
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  // ── This Month ──
  const thisMonthRevenue = allPayments
    .filter((p) => new Date(p.paidAt) >= startOfMonth)
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  // ── Last Month ──
  const lastMonthRevenue = allPayments
    .filter((p) => {
      const d = new Date(p.paidAt);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    })
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  // ── Total GST ──
  const totalGST = allPayments
    .reduce((sum, p) => sum + (p.gstAmount || 0), 0);

  // ── MRR & ARR ──
  const mrr = thisMonthRevenue;
  const arr = parseFloat((mrr * 12).toFixed(2));

  // ── Active Tenants ──
  const activeTenants = await prisma.tenant.count({
    where: { planStatus: "active", isActive: true },
  });

  // ── Total Payments Count ──
  const totalPayments = allPayments.length;

  // ── Monthly Breakdown (last 6 months) ──
  const monthlyBreakdown = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthLabel = monthStart.toLocaleString("default", {
      month: "short",
      year: "2-digit",
    });

    const monthPayments = allPayments.filter((p) => {
      const d = new Date(p.paidAt);
      return d >= monthStart && d <= monthEnd;
    });

    const monthRevenue = monthPayments
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    monthlyBreakdown.push({
      month: monthLabel,
      revenue: parseFloat(monthRevenue.toFixed(2)),
      transactions: monthPayments.length,
    });
  }

  // ── Plan Distribution ──
  const planMap = {};
  for (const p of allPayments) {
    if (!p.planId) continue;
    if (!planMap[p.planId]) {
      planMap[p.planId] = {
        planId: p.planId,
        planName: p.planName,
        count: 0,
      };
    }
    planMap[p.planId].count += 1;
  }

  const planIds = Object.keys(planMap);
  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, monthlyPrice: true },
  });

  const planDistribution = Object.values(planMap).map((p) => {
    const planDetail = plans.find((pl) => pl.id === p.planId);
    return { ...p, monthlyPrice: planDetail?.monthlyPrice || 0 };
  });

  return {
    totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
    thisMonthRevenue: parseFloat(thisMonthRevenue.toFixed(2)),
    lastMonthRevenue: parseFloat(lastMonthRevenue.toFixed(2)),
    totalGST:         parseFloat(totalGST.toFixed(2)),
    mrr:              parseFloat(mrr.toFixed(2)),
    arr,
    activeTenants,
    totalPayments,
    monthlyBreakdown,
    planDistribution,
  };
};


// ── All Payments ──
export const getRevenuePaymentsService = async () => {
  return await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      planName: true,
      billingType: true,
      baseAmount: true,
      gstPercent: true,
      gstAmount: true,
      totalAmount: true,
      currency: true,
      paymentMethod: true,
      status: true,
      paidAt: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          tenantName: true,
          email: true,
        },
      },
    },
  });
};


// ── Tenant Billing Detail ──
export const getTenantBillingDetailService = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      tenantName: true,
      email: true,
      phone: true,
      planStatus: true,
      billingType: true,
      planActivatedAt: true,
      plan: {
        select: { id: true, name: true, monthlyPrice: true },
      },
    },
  });

  if (!tenant) return null;

  const payments = await prisma.payment.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      planName: true,
      billingType: true,
      baseAmount: true,
      gstAmount: true,
      totalAmount: true,
      paymentMethod: true,
      razorpayPaymentId: true,
      razorpayOrderId: true,
      status: true,
      paidAt: true,
      createdAt: true,
      invoiceUrl: true,
    },
  });

  // ── Next Renewal Date ──
  let nextRenewalDate = null;
  if (tenant.planActivatedAt && tenant.planStatus === "active") {
    const activatedAt = new Date(tenant.planActivatedAt);
    nextRenewalDate = new Date(activatedAt);
    if (tenant.billingType === "annual") {
      nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
    } else {
      nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    }
  }

  const totalSpent = payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  return {
    tenant: { ...tenant, nextRenewalDate },
    payments,
    totalSpent: parseFloat(totalSpent.toFixed(2)),
  };
};


// ── Invoice URL ──
export const getInvoiceUrlService = async (paymentId) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, status: "SUCCESS" },
  });

  if (!payment || !payment.invoiceUrl) return null;

  return `${process.env.BACKEND_URL || "http://localhost:5000"}${payment.invoiceUrl}`;
};
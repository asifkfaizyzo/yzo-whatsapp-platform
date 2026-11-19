// backend/src/modules/tenant/addons/tenant.addons.service.js (do not remove this comment)
import { Prisma, AuditAction, AuditModule } from "@prisma/client";
import env from "../../../config/env.js";
import prisma from "../../../config/prisma.js";
import razorpay from "../../../config/razorpay.js";
import { ENTITLEMENT_MAP } from "../../../config/entitlements.config.js";
import { grantCredits } from "../../../lib/entitlements/usage.service.js";
import { calculateGST as rawCalculateGST } from "../../../lib/billing.js";
import {
  generateInvoiceNumber,
  generateInvoicePDF,
  getInvoiceSettings,
} from "../../../lib/invoice.js";
import {
  addCycleDuration,
  cancelRazorpaySubscriptionBestEffort,
  getOrCreateRazorpayPlanForAddOn,
} from "../../../lib/billingPeriod.js";
import { verifyRazorpayHmac } from "../plans/tenant.plans.service.js";
import { logTenantAudit } from "../../audit/tenant.audit.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";
import { sendInvoiceEmail } from "../../email/index.js";
import { HttpError } from "../../../utils/httpError.js";
import logger from "../../../utils/logger.js";

const getGSTSettings = getInvoiceSettings;

async function calculateGST(amount) {
  const res = await rawCalculateGST(amount);
  const taxRate = Number(res.taxRate ?? res.gstPercent ?? 0);
  const taxAmount = Number(res.taxAmount ?? res.gstAmount ?? 0);
  return {
    ...res,
    baseAmount: Number(res.baseAmount ?? amount ?? 0),
    taxRate,
    taxAmount,
    totalAmount: Number(res.totalAmount ?? 0),
    gstRegistered:
      res.gstRegistered !== undefined ? Boolean(res.gstRegistered) : taxRate > 0,
    taxLabel: res.taxLabel || "GST",
    currency: res.currency || "INR",
  };
}

/**
 * Ensures the tenant has an operational base subscription before purchasing
 * mid-cycle add-ons or credit top-ups (Decision 23).
 */
export function isBaseSubscriptionOperational(sub, now = new Date()) {
  if (!sub) return false;

  if (
    sub.freeUntilDate &&
    new Date(sub.freeUntilDate).getTime() > now.getTime()
  ) {
    return true;
  }

  if (
    ["active", "trialing", "cancel_at_period_end"].includes(
      sub.subscriptionStatus
    ) &&
    (!sub.planPeriodEnd ||
      new Date(sub.planPeriodEnd).getTime() > now.getTime())
  ) {
    return true;
  }

  if (
    sub.subscriptionStatus === "payment_failed" &&
    sub.gracePeriodEnd &&
    new Date(sub.gracePeriodEnd).getTime() > now.getTime()
  ) {
    return true;
  }

  return false;
}

function assertBaseSubscriptionOperational(sub, now = new Date()) {
  if (!isBaseSubscriptionOperational(sub, now)) {
    throw new HttpError(
      403,
      "An active base subscription is required to purchase add-ons or credit top-ups.",
      "BASE_SUBSCRIPTION_INACTIVE"
    );
  }
}

async function generateAndEmailAddOnInvoiceBestEffort(
  invoice,
  tenant,
  gstSettings
) {
  try {
    const { filePath, fileUrl, url } = await generateInvoicePDF(
      invoice,
      tenant,
      gstSettings
    );

    if (tenant?.email) {
      await sendInvoiceEmail(tenant.email, {
        businessName: tenant.businessName,
        invoiceNumber: invoice.invoiceNumber,
        planName: invoice.planName || "SudoReply Add-On",
        billingType: invoice.billingCycle,
        baseAmount: invoice.baseAmount,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        gstPercent: invoice.taxRate,
        gstAmount: invoice.taxAmount,
        gstType: gstSettings?.gstType || null,
        gstNumber: gstSettings?.gstNumber || null,
        sacCode: gstSettings?.sacCode || null,
        totalAmount: invoice.amount,
        paidAt: invoice.paidAt || invoice.createdAt,
        periodStart: invoice.billingPeriodStart,
        periodEnd: invoice.billingPeriodEnd,
        invoiceUrl: fileUrl || url || invoice.invoiceUrl,
        pdfPath: filePath,
      });
    }
  } catch (err) {
    logger.error("Non-fatal add-on invoice PDF/email error", {
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      tenantId: tenant?.id,
      error: err?.message,
    });
  }
}

function formatAddOnWithTax(addOn, gstRef) {
  const base = Number(addOn.price || 0);
  const taxRate = gstRef.gstRegistered ? Number(gstRef.taxRate || 0) : 0;
  const taxAmount = gstRef.gstRegistered
    ? Math.round(base * (taxRate / 100) * 100) / 100
    : 0;
  const totalAmount = Math.round((base + taxAmount) * 100) / 100;
  const entitlementDef = ENTITLEMENT_MAP[addOn.entitlementKey] || null;

  return {
    id: addOn.id,
    name: addOn.name,
    slug: addOn.slug,
    description: addOn.description,
    type: addOn.type,
    entitlementKey: addOn.entitlementKey,
    entitlementLabel: entitlementDef?.label || addOn.entitlementKey,
    entitlementCategory: entitlementDef?.category || null,
    entitlementUnit: entitlementDef?.unit || null,
    amountPerUnit: addOn.amountPerUnit,
    price: base,
    billingCycle: addOn.billingCycle,
    sortOrder: addOn.sortOrder,
    pricing: {
      baseAmount: base,
      taxRate,
      taxAmount,
      totalAmount,
      currency: gstRef.currency || "INR",
      taxLabel: gstRef.taxLabel || "GST",
      gstRegistered: Boolean(gstRef.gstRegistered),
    },
  };
}

function formatTenantAddOnRow(row, now = new Date()) {
  const isExpiredByDate = Boolean(
    row.expiresAt && new Date(row.expiresAt).getTime() <= now.getTime()
  );
  const isEffective =
    ["active", "cancel_at_period_end"].includes(row.status) && !isExpiredByDate;

  return {
    id: row.id,
    tenantId: row.tenantId,
    addOnId: row.addOnId,
    quantity: row.quantity,
    status: row.status,
    source: row.source,
    razorpaySubscriptionId: row.razorpaySubscriptionId,
    autopayEnabled: Boolean(
      row.razorpaySubscriptionId && row.status === "active"
    ),
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    cancelledAt: row.cancelledAt,
    isEffective,
    totalEntitlementGrant:
      Number(row.addOn?.amountPerUnit || 0) * Number(row.quantity || 1),
    addOn: row.addOn
      ? {
          id: row.addOn.id,
          name: row.addOn.name,
          slug: row.addOn.slug,
          description: row.addOn.description,
          type: row.addOn.type,
          entitlementKey: row.addOn.entitlementKey,
          amountPerUnit: row.addOn.amountPerUnit,
          price: row.addOn.price,
          billingCycle: row.addOn.billingCycle,
        }
      : null,
  };
}

/**
 * GET /tenant/billing/addons
 * Lists the active PlanAddOn catalog, the tenant's purchased/granted TenantAddOn rows,
 * and the tenant's TenantCreditPool balances.
 */
export async function listTenantAddOnsService(tenantId) {
  const now = new Date();

  const [catalog, tenantAddOns, creditPools, sub, gstRef] = await Promise.all([
    prisma.planAddOn.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    }),
    prisma.tenantAddOn.findMany({
      where: { tenantId },
      include: { addOn: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenantCreditPool.findMany({
      where: { tenantId },
      orderBy: { entitlementKey: "asc" },
    }),
    prisma.tenantSubscription.findUnique({
      where: { tenantId },
    }),
    calculateGST(100),
  ]);

  const formattedRows = tenantAddOns.map((r) => formatTenantAddOnRow(r, now));

  return {
    canPurchase: isBaseSubscriptionOperational(sub, now),
    catalog: catalog.map((a) => formatAddOnWithTax(a, gstRef)),
    activeAddOns: formattedRows.filter((r) => r.isEffective),
    allTenantAddOns: formattedRows,
    creditPools: creditPools.map((cp) => ({
      id: cp.id,
      entitlementKey: cp.entitlementKey,
      entitlementLabel:
        ENTITLEMENT_MAP[cp.entitlementKey]?.label || cp.entitlementKey,
      balance: cp.balance,
      totalPurchased: cp.totalPurchased,
      totalUsed: cp.totalUsed,
      updatedAt: cp.updatedAt,
    })),
    tax: {
      taxRate: gstRef.gstRegistered ? gstRef.taxRate : 0,
      taxLabel: gstRef.taxLabel,
      gstRegistered: gstRef.gstRegistered,
      currency: gstRef.currency,
    },
  };
}

/**
 * POST /tenant/billing/addons/create-order
 * Creates a one-time Razorpay Order for either a ONE_TIME_TOPUP or a single cycle
 * of a RECURRING add-on.
 */
export async function createAddOnOrderService(
  tenantId,
  { addOnId, quantity = 1 }
) {
  const now = new Date();

  const [tenant, addOn] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    }),
    prisma.planAddOn.findUnique({
      where: { id: addOnId },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  assertBaseSubscriptionOperational(tenant.subscription, now);

  if (!addOn || !addOn.isActive) {
    throw new HttpError(
      404,
      "Add-on not found or is no longer available for purchase.",
      "ADDON_NOT_AVAILABLE"
    );
  }

  const unitPrice = Number(addOn.price || 0);
  if (unitPrice <= 0) {
    throw new HttpError(
      400,
      "Cannot create a payment order for a zero-price add-on.",
      "INVALID_ADDON_PRICE"
    );
  }

  const baseAmount = Math.round(unitPrice * quantity * 100) / 100;
  const gst = await calculateGST(baseAmount);
  const amountInPaise = Math.round(gst.totalAmount * 100);

  const purchaseType = addOn.type === "ONE_TIME_TOPUP" ? "TOPUP" : "ADDON";
  const billingCycle =
    addOn.type === "ONE_TIME_TOPUP" ? "ONE_TIME" : addOn.billingCycle;

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `add_${tenantId.slice(0, 8)}_${Date.now()}`,
    notes: {
      kind: "ADDON_ORDER",
      tenantId,
      addOnId: addOn.id,
      addOnName: addOn.name,
      purchaseType,
      billingCycle,
      quantity: String(quantity),
      baseAmount: String(gst.baseAmount),
      taxRate: String(gst.taxRate),
      taxAmount: String(gst.taxAmount),
      totalAmount: String(gst.totalAmount),
    },
  });

  await prisma.payment.create({
    data: {
      tenantId,
      addOnId: addOn.id,
      purchaseType,
      razorpayOrderId: order.id,
      baseAmount: gst.baseAmount,
      taxRate: gst.taxRate,
      taxAmount: gst.taxAmount,
      amount: gst.totalAmount,
      currency: "INR",
      status: "PENDING",
      billingCycle,
      metadata: {
        addOnName: addOn.name,
        addOnSlug: addOn.slug,
        addOnType: addOn.type,
        entitlementKey: addOn.entitlementKey,
        amountPerUnit: addOn.amountPerUnit,
        quantity,
      },
    },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: env.RAZORPAY_KEY_ID,
    addOnId: addOn.id,
    addOnName: addOn.name,
    addOnType: addOn.type,
    purchaseType,
    billingCycle,
    quantity,
    entitlementKey: addOn.entitlementKey,
    totalUnitsGranted: Number(addOn.amountPerUnit || 0) * quantity,
    baseAmount: gst.baseAmount,
    taxRate: gst.taxRate,
    taxAmount: gst.taxAmount,
    totalAmount: gst.totalAmount,
    taxLabel: gst.taxLabel,
    gstRegistered: gst.gstRegistered,
    prefill: {
      name: tenant.businessName,
      email: tenant.email,
      contact: tenant.phone || "",
    },
  };
}

/**
 * Shared idempotent order-fulfillment helper for standalone ADDON / TOPUP orders.
 * Used by both POST /tenant/billing/addons/verify-order and the Razorpay webhook.
 */
export async function fulfillAddOnOrderByOrderId({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature = null,
  paymentMethod = null,
  expectedTenantId = null,
  meta = {},
}) {
  const existingPayments = await prisma.payment.findMany({
    where: { razorpayOrderId },
    orderBy: { createdAt: "asc" },
  });

  // If this order contains a PLAN payment row, it is a bundled plan order (handled by fulfillPlanOrderByOrderId).
  if (
    existingPayments.length === 0 ||
    existingPayments.some((p) => p.purchaseType === "PLAN")
  ) {
    return { handled: false };
  }

  const targetPaymentPreview = existingPayments[0];
  if (
    expectedTenantId &&
    targetPaymentPreview.tenantId !== expectedTenantId
  ) {
    throw new HttpError(
      403,
      "This payment order does not belong to your account.",
      "ORDER_TENANT_MISMATCH"
    );
  }

  let resolvedPaymentMethod = paymentMethod;
  if (!resolvedPaymentMethod && razorpayPaymentId) {
    try {
      const rzpPayment = await razorpay.payments.fetch(razorpayPaymentId);
      resolvedPaymentMethod = rzpPayment?.method || null;
    } catch (err) {
      logger.warn("Could not fetch add-on payment method from Razorpay", {
        razorpayPaymentId,
        error: err?.message,
      });
    }
  }

  const now = new Date();
  const tenantId = targetPaymentPreview.tenantId;

  const txResult = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "payments" WHERE "id" = ${targetPaymentPreview.id} FOR UPDATE`
    );

    const payment = await tx.payment.findUnique({
      where: { id: targetPaymentPreview.id },
    });

    if (payment.status === "SUCCESS") {
      const existingInvoice = await tx.invoice.findFirst({
        where: { paymentId: payment.id },
      });
      return {
        alreadyProcessed: true,
        payment,
        invoice: existingInvoice,
      };
    }

    const [tenant, addOn] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId } }),
      payment.addOnId
        ? tx.planAddOn.findUnique({ where: { id: payment.addOnId } })
        : null,
    ]);

    if (!tenant) {
      throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
    }

    const quantity = Math.max(1, Number(payment.metadata?.quantity || 1));
    const entitlementKey =
      addOn?.entitlementKey || payment.metadata?.entitlementKey;
    const amountPerUnit = Number(
      addOn?.amountPerUnit ?? payment.metadata?.amountPerUnit ?? 0
    );
    const addOnName =
      addOn?.name || payment.metadata?.addOnName || "Plan Add-On";
    const addOnSlug = addOn?.slug || payment.metadata?.addOnSlug || "addon";

    const invoiceNumber = await generateInvoiceNumber(tx);
    const invoiceUrl = `/invoices/${invoiceNumber}.pdf`;

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: "SUCCESS",
        paymentMethod: resolvedPaymentMethod,
        invoiceNumber,
        invoiceUrl,
      },
    });

    let updatedPool = null;
    let tenantAddOnRecord = null;
    let periodEnd = null;
    const isTopUp =
      payment.purchaseType === "TOPUP" || addOn?.type === "ONE_TIME_TOPUP";

    if (isTopUp) {
      const totalCredits = amountPerUnit * quantity;
      if (!entitlementKey || totalCredits <= 0) {
        throw new HttpError(
          400,
          "Invalid credit top-up configuration.",
          "INVALID_TOPUP_CONFIG"
        );
      }
      updatedPool = await grantCredits(
        tenantId,
        entitlementKey,
        totalCredits,
        tx
      );
    } else {
      const cycle = addOn?.billingCycle || payment.billingCycle || "MONTHLY";

      const existingManualAddOn = await tx.tenantAddOn.findFirst({
        where: {
          tenantId,
          addOnId: addOn?.id || payment.addOnId,
          razorpaySubscriptionId: null,
          quantity,
          status: { in: ["active", "cancel_at_period_end"] },
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "desc" },
      });

      if (existingManualAddOn) {
        periodEnd = addCycleDuration(
          new Date(existingManualAddOn.expiresAt),
          cycle
        );
        tenantAddOnRecord = await tx.tenantAddOn.update({
          where: { id: existingManualAddOn.id },
          data: {
            status: "active",
            cancelledAt: null,
            expiresAt: periodEnd,
          },
          include: { addOn: true },
        });
      } else {
        periodEnd = addCycleDuration(now, cycle);
        tenantAddOnRecord = await tx.tenantAddOn.create({
          data: {
            tenantId,
            addOnId: addOn?.id || payment.addOnId,
            quantity,
            status: "active",
            source: "PURCHASE",
            startsAt: now,
            expiresAt: periodEnd,
          },
          include: { addOn: true },
        });
      }
    }

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        paymentId: updatedPayment.id,
        planSlug: addOnSlug,
        planName: addOnName,
        billingCycle: isTopUp
          ? "ONE_TIME"
          : addOn?.billingCycle || payment.billingCycle || "MONTHLY",
        purchaseType: isTopUp ? "TOPUP" : "ADDON",
        baseAmount: updatedPayment.baseAmount,
        taxRate: updatedPayment.taxRate,
        taxAmount: updatedPayment.taxAmount,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency || "INR",
        status: "paid",
        paidAt: now,
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        invoiceUrl,
      },
    });

    return {
      alreadyProcessed: false,
      tenant,
      addOn,
      addOnName,
      entitlementKey,
      amountPerUnit,
      quantity,
      isTopUp,
      updatedPayment,
      invoice,
      updatedPool,
      tenantAddOnRecord,
    };
  });

  if (txResult.alreadyProcessed) {
    return {
      handled: true,
      alreadyProcessed: true,
      invoice: txResult.invoice,
    };
  }

  const gstSettings = await getGSTSettings();
  await generateAndEmailAddOnInvoiceBestEffort(
    txResult.invoice,
    txResult.tenant,
    gstSettings
  );

  const actorName =
    meta.actorName || txResult.tenant.businessName || txResult.tenant.email;

  await logTenantAudit({
    tenantId,
    actorType: meta.actorType || "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: AuditAction.PAYMENT_SUCCESS,
    module: AuditModule.BILLING,
    targetId: txResult.updatedPayment.id,
    targetRef: txResult.invoice.invoiceNumber,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      purchaseType: txResult.isTopUp ? "TOPUP" : "ADDON",
      addOnId: txResult.updatedPayment.addOnId,
      addOnName: txResult.addOnName,
      quantity: txResult.quantity,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
      razorpayOrderId,
      razorpayPaymentId,
    },
  });

  await logTenantAudit({
    tenantId,
    actorType: meta.actorType || "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: txResult.isTopUp
      ? AuditAction.TOPUP_PURCHASED
      : AuditAction.ADDON_PURCHASED,
    module: AuditModule.BILLING,
    targetId: txResult.updatedPayment.addOnId,
    targetRef: txResult.addOnName,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      addOnId: txResult.updatedPayment.addOnId,
      addOnName: txResult.addOnName,
      entitlementKey: txResult.entitlementKey,
      quantity: txResult.quantity,
      unitsGranted: txResult.amountPerUnit * txResult.quantity,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
      expiresAt: txResult.tenantAddOnRecord?.expiresAt || null,
    },
  });

  await createSuperAdminNotification({
    type: "payment_received",
    title: txResult.isTopUp ? "Credit Top-Up Purchased" : "Add-On Purchased",
    message: `${
      txResult.tenant.businessName || txResult.tenant.email
    } purchased ${txResult.addOnName} (x${txResult.quantity}) — ₹${
      txResult.invoice.amount
    }.`,
    tenantId,
    metadata: {
      purchaseType: txResult.isTopUp ? "TOPUP" : "ADDON",
      addOnId: txResult.updatedPayment.addOnId,
      addOnName: txResult.addOnName,
      quantity: txResult.quantity,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
    },
  });

  return {
    handled: true,
    alreadyProcessed: false,
    purchaseType: txResult.isTopUp ? "TOPUP" : "ADDON",
    invoice: txResult.invoice,
    creditPool: txResult.updatedPool,
    tenantAddOn: txResult.tenantAddOnRecord
      ? formatTenantAddOnRow(txResult.tenantAddOnRecord, now)
      : null,
  };
}

/**
 * POST /tenant/billing/addons/verify-order
 * Verifies Razorpay signature and fulfills the add-on or credit top-up order.
 */
export async function verifyAddOnOrderService(
  tenantId,
  { razorpay_order_id, razorpay_payment_id, razorpay_signature },
  meta = {}
) {
  const isValid = verifyRazorpayHmac(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    razorpay_signature
  );

  if (!isValid) {
    await prisma.payment.updateMany({
      where: {
        razorpayOrderId: razorpay_order_id,
        tenantId,
        status: "PENDING",
      },
      data: { status: "FAILED" },
    });

    await logTenantAudit({
      tenantId,
      actorType: "TENANT",
      actorId: meta.actorId || tenantId,
      actorName: meta.actorName || null,
      action: AuditAction.PAYMENT_FAILED,
      module: AuditModule.BILLING,
      targetRef: razorpay_order_id,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      details: {
        reason: "Add-on order signature verification failed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    throw new HttpError(
      400,
      "Payment verification failed — invalid signature.",
      "INVALID_PAYMENT_SIGNATURE"
    );
  }

  const fulfilled = await fulfillAddOnOrderByOrderId({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    expectedTenantId: tenantId,
    meta,
  });

  if (!fulfilled.handled) {
    throw new HttpError(
      404,
      "Matching add-on payment order was not found.",
      "ORDER_NOT_FOUND"
    );
  }

  return fulfilled;
}

/**
 * POST /tenant/billing/addons/create-subscription
 * Creates an independent recurring Razorpay Subscription for a RECURRING PlanAddOn.
 */
export async function createAddOnSubscriptionService(
  tenantId,
  { addOnId, quantity = 1 }
) {
  const now = new Date();

  const [tenant, addOn] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    }),
    prisma.planAddOn.findUnique({
      where: { id: addOnId },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  assertBaseSubscriptionOperational(tenant.subscription, now);

  if (!addOn || !addOn.isActive) {
    throw new HttpError(
      404,
      "Add-on not found or is no longer available for purchase.",
      "ADDON_NOT_AVAILABLE"
    );
  }

  if (addOn.type !== "RECURRING") {
    throw new HttpError(
      400,
      "One-time credit top-ups must be purchased via create-order, not recurring subscriptions.",
      "INVALID_ADDON_TYPE"
    );
  }

  const unitPrice = Number(addOn.price || 0);
  if (unitPrice <= 0) {
    throw new HttpError(
      400,
      "Recurring autopay cannot be created for a zero-price add-on.",
      "INVALID_ADDON_PRICE"
    );
  }

  const lineBaseAmount = Math.round(unitPrice * quantity * 100) / 100;
  const gst = await calculateGST(lineBaseAmount);

  let rzpPlanId = await getOrCreateRazorpayPlanForAddOn(addOn, false);

  const totalCount =
    addOn.billingCycle === "ANNUAL"
      ? 5
      : addOn.billingCycle === "QUARTERLY"
      ? 20
      : 60;

  const subPayload = {
    plan_id: rzpPlanId,
    total_count: totalCount,
    quantity,
    customer_notify: 1,
    notes: {
      kind: "ADDON",
      tenantId,
      addOnId: addOn.id,
      addOnName: addOn.name,
      billingCycle: addOn.billingCycle,
      quantity: String(quantity),
      baseAmount: String(gst.baseAmount),
      taxRate: String(gst.taxRate),
      taxAmount: String(gst.taxAmount),
      totalAmount: String(gst.totalAmount),
    },
  };

  let rzpSubscription;
  try {
    rzpSubscription = await razorpay.subscriptions.create(subPayload);
  } catch (err) {
    if (
      err?.statusCode === 400 &&
      err?.error?.code === "BAD_REQUEST_ERROR"
    ) {
      logger.warn(
        "Stale Razorpay add-on plan ID detected — recreating and retrying",
        {
          addOnId: addOn.id,
          staleRzpPlanId: rzpPlanId,
        }
      );
      rzpPlanId = await getOrCreateRazorpayPlanForAddOn(addOn, true);
      subPayload.plan_id = rzpPlanId;
      rzpSubscription = await razorpay.subscriptions.create(subPayload);
    } else {
      throw err;
    }
  }

  return {
    subscriptionId: rzpSubscription.id,
    key: env.RAZORPAY_KEY_ID,
    addOnId: addOn.id,
    addOnName: addOn.name,
    billingCycle: addOn.billingCycle,
    quantity,
    entitlementKey: addOn.entitlementKey,
    totalUnitsGranted: Number(addOn.amountPerUnit || 0) * quantity,
    baseAmount: gst.baseAmount,
    taxRate: gst.taxRate,
    taxAmount: gst.taxAmount,
    totalAmount: gst.totalAmount,
    taxLabel: gst.taxLabel,
    gstRegistered: gst.gstRegistered,
    currency: "INR",
    prefill: {
      name: tenant.businessName,
      email: tenant.email,
      contact: tenant.phone || "",
    },
  };
}

/**
 * POST /tenant/billing/addons/verify-subscription
 * Verifies a recurring add-on Razorpay subscription signature and activates TenantAddOn.
 */
export async function verifyAddOnSubscriptionService(
  tenantId,
  {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    addOnId,
    quantity = 1,
  },
  meta = {}
) {
  const isValid = verifyRazorpayHmac(
    `${razorpay_payment_id}|${razorpay_subscription_id}`,
    razorpay_signature
  );

  if (!isValid) {
    await logTenantAudit({
      tenantId,
      actorType: "TENANT",
      actorId: meta.actorId || tenantId,
      actorName: meta.actorName || null,
      action: AuditAction.PAYMENT_FAILED,
      module: AuditModule.BILLING,
      targetRef: razorpay_subscription_id,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      details: {
        reason: "Add-on subscription signature verification failed",
        razorpaySubscriptionId: razorpay_subscription_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    throw new HttpError(
      400,
      "Add-on subscription verification failed — invalid signature.",
      "INVALID_PAYMENT_SIGNATURE"
    );
  }

  let paymentMethod = "autopay";
  try {
    const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    paymentMethod = rzpPayment?.method || "autopay";
  } catch (err) {
    logger.warn("Could not fetch add-on subscription payment method", {
      razorpayPaymentId: razorpay_payment_id,
      error: err?.message,
    });
  }

  const now = new Date();

  const txResult = await prisma.$transaction(async (tx) => {
    const existingPayment = await tx.payment.findUnique({
      where: { razorpayPaymentId: razorpay_payment_id },
    });

    if (existingPayment && existingPayment.status === "SUCCESS") {
      const [existingTenantAddOn, existingInvoice] = await Promise.all([
        tx.tenantAddOn.findUnique({
          where: { razorpaySubscriptionId: razorpay_subscription_id },
          include: { addOn: true },
        }),
        tx.invoice.findFirst({
          where: { paymentId: existingPayment.id },
        }),
      ]);

      return {
        alreadyProcessed: true,
        tenantAddOnRecord: existingTenantAddOn,
        invoice: existingInvoice,
      };
    }

    const [tenant, addOn] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId } }),
      tx.planAddOn.findUnique({ where: { id: addOnId } }),
    ]);

    if (!tenant) {
      throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
    }
    if (!addOn || addOn.type !== "RECURRING") {
      throw new HttpError(404, "Recurring add-on not found.", "ADDON_NOT_FOUND");
    }

    const lineBaseAmount =
      Math.round(Number(addOn.price || 0) * quantity * 100) / 100;
    const gst = await calculateGST(lineBaseAmount);
    const expiresAt = addCycleDuration(now, addOn.billingCycle);

    const invoiceNumber = await generateInvoiceNumber(tx);
    const invoiceUrl = `/invoices/${invoiceNumber}.pdf`;

    const paymentRecord = existingPayment
      ? await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            razorpaySignature: razorpay_signature,
            status: "SUCCESS",
            paymentMethod,
            invoiceNumber,
            invoiceUrl,
          },
        })
      : await tx.payment.create({
          data: {
            tenantId,
            addOnId: addOn.id,
            purchaseType: "ADDON",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            baseAmount: gst.baseAmount,
            taxRate: gst.taxRate,
            taxAmount: gst.taxAmount,
            amount: gst.totalAmount,
            currency: "INR",
            status: "SUCCESS",
            paymentMethod,
            billingCycle: addOn.billingCycle,
            invoiceNumber,
            invoiceUrl,
            notes: razorpay_subscription_id,
            metadata: {
              addOnName: addOn.name,
              addOnSlug: addOn.slug,
              entitlementKey: addOn.entitlementKey,
              amountPerUnit: addOn.amountPerUnit,
              quantity,
              razorpaySubscriptionId: razorpay_subscription_id,
            },
          },
        });

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        paymentId: paymentRecord.id,
        planSlug: addOn.slug,
        planName: addOn.name,
        billingCycle: addOn.billingCycle,
        purchaseType: "ADDON",
        baseAmount: gst.baseAmount,
        taxRate: gst.taxRate,
        taxAmount: gst.taxAmount,
        amount: gst.totalAmount,
        currency: "INR",
        status: "paid",
        paidAt: now,
        billingPeriodStart: now,
        billingPeriodEnd: expiresAt,
        invoiceUrl,
      },
    });

    const tenantAddOnRecord = await tx.tenantAddOn.upsert({
      where: { razorpaySubscriptionId: razorpay_subscription_id },
      update: {
        quantity,
        status: "active",
        cancelledAt: null,
        expiresAt,
      },
      create: {
        tenantId,
        addOnId: addOn.id,
        quantity,
        status: "active",
        source: "PURCHASE",
        razorpaySubscriptionId: razorpay_subscription_id,
        startsAt: now,
        expiresAt,
      },
      include: { addOn: true },
    });

    return {
      alreadyProcessed: false,
      tenant,
      addOn,
      quantity,
      paymentRecord,
      invoice,
      tenantAddOnRecord,
    };
  });

  if (txResult.alreadyProcessed) {
    return {
      alreadyProcessed: true,
      tenantAddOn: txResult.tenantAddOnRecord
        ? formatTenantAddOnRow(txResult.tenantAddOnRecord, now)
        : null,
      invoice: txResult.invoice,
    };
  }

  const gstSettings = await getGSTSettings();
  await generateAndEmailAddOnInvoiceBestEffort(
    txResult.invoice,
    txResult.tenant,
    gstSettings
  );

  const actorName =
    meta.actorName || txResult.tenant.businessName || txResult.tenant.email;

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: AuditAction.PAYMENT_SUCCESS,
    module: AuditModule.BILLING,
    targetId: txResult.paymentRecord.id,
    targetRef: txResult.invoice.invoiceNumber,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      purchaseType: "ADDON",
      addOnId: txResult.addOn.id,
      addOnName: txResult.addOn.name,
      quantity: txResult.quantity,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      autopay: true,
    },
  });

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: AuditAction.ADDON_PURCHASED,
    module: AuditModule.BILLING,
    targetId: txResult.addOn.id,
    targetRef: txResult.addOn.name,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      tenantAddOnId: txResult.tenantAddOnRecord.id,
      addOnId: txResult.addOn.id,
      addOnName: txResult.addOn.name,
      entitlementKey: txResult.addOn.entitlementKey,
      quantity: txResult.quantity,
      unitsGranted: Number(txResult.addOn.amountPerUnit || 0) * txResult.quantity,
      billingCycle: txResult.addOn.billingCycle,
      razorpaySubscriptionId: razorpay_subscription_id,
      expiresAt: txResult.tenantAddOnRecord.expiresAt,
    },
  });

  await createSuperAdminNotification({
    type: "payment_received",
    title: "Recurring Add-On Activated",
    message: `${
      txResult.tenant.businessName || txResult.tenant.email
    } activated ${txResult.addOn.name} (x${txResult.quantity}, ${
      txResult.addOn.billingCycle
    } Autopay) — ₹${txResult.invoice.amount}.`,
    tenantId,
    metadata: {
      tenantAddOnId: txResult.tenantAddOnRecord.id,
      addOnId: txResult.addOn.id,
      addOnName: txResult.addOn.name,
      quantity: txResult.quantity,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
      razorpaySubscriptionId: razorpay_subscription_id,
    },
  });

  return {
    alreadyProcessed: false,
    tenantAddOn: formatTenantAddOnRow(txResult.tenantAddOnRecord, now),
    invoice: txResult.invoice,
  };
}

/**
 * POST /tenant/billing/addons/:tenantAddOnId/cancel
 * Cancels a recurring add-on at the end of its current period.
 * Status becomes "cancel_at_period_end" and entitlement stays active until expiresAt.
 */
export async function cancelTenantAddOnService(
  tenantId,
  tenantAddOnId,
  { reason } = {},
  meta = {}
) {
  const now = new Date();

  const [tenant, tenantAddOn] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.tenantAddOn.findFirst({
      where: { id: tenantAddOnId, tenantId },
      include: { addOn: true },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  if (!tenantAddOn) {
    throw new HttpError(404, "Purchased add-on not found.", "ADDON_NOT_FOUND");
  }

  if (tenantAddOn.status !== "active") {
    throw new HttpError(
      409,
      `This add-on cannot be cancelled because its current status is "${tenantAddOn.status}".`,
      "ADDON_ALREADY_CANCELLED"
    );
  }

  if (tenantAddOn.razorpaySubscriptionId) {
    const cancelRes = await cancelRazorpaySubscriptionBestEffort(
      tenantAddOn.razorpaySubscriptionId,
      { atCycleEnd: true }
    );
    if (cancelRes.error) {
      await cancelRazorpaySubscriptionBestEffort(
        tenantAddOn.razorpaySubscriptionId,
        { atCycleEnd: false }
      );
    }
  }

  const isAlreadyPastExpiry = Boolean(
    tenantAddOn.expiresAt &&
      new Date(tenantAddOn.expiresAt).getTime() <= now.getTime()
  );

  const nextStatus = isAlreadyPastExpiry
    ? "expired"
    : tenantAddOn.expiresAt
    ? "cancel_at_period_end"
    : "cancelled";

  const updated = await prisma.tenantAddOn.update({
    where: { id: tenantAddOn.id },
    data: {
      status: nextStatus,
      cancelledAt: now,
    },
    include: { addOn: true },
  });

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.ADDON_CANCELLED,
    module: AuditModule.BILLING,
    targetId: updated.id,
    targetRef: updated.addOn?.name || updated.addOnId,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      tenantAddOnId: updated.id,
      addOnId: updated.addOnId,
      addOnName: updated.addOn?.name || null,
      quantity: updated.quantity,
      status: updated.status,
      effectiveUntil: updated.expiresAt,
      reason: reason || null,
    },
  });

  await createSuperAdminNotification({
    type: "subscription_cancelled",
    title: "Add-On Cancelled",
    message: `${tenant.businessName || tenant.email} cancelled add-on "${
      updated.addOn?.name || updated.addOnId
    }" (active until ${
      updated.expiresAt
        ? new Date(updated.expiresAt).toLocaleDateString("en-IN")
        : "immediately"
    }).`,
    tenantId,
    metadata: {
      tenantAddOnId: updated.id,
      addOnId: updated.addOnId,
      addOnName: updated.addOn?.name || null,
      expiresAt: updated.expiresAt,
      reason: reason || null,
    },
  });

  return {
    tenantAddOn: formatTenantAddOnRow(updated, now),
  };
}

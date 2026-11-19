// backend/src/modules/webhook/razorpay/razorpay.webhook.controller.js (do not remove this comment)
import crypto from "crypto";
import prisma from "../../../config/prisma.js";
import { calculateGST } from "../../../lib/billing.js";
import {
  calculatePeriodEnd,
  getMonthlyEquivalentPrice,
} from "../../../lib/billingPeriod.js";
import {
  generateInvoiceNumber,
  generateInvoicePDF,
  getInvoiceSettings,
} from "../../../lib/invoice.js";
import { grantCredits } from "../../../lib/entitlements/usage.service.js";
import {
  sendInvoiceEmail,
  sendGracePeriodStartedEmail,
  sendAddonPurchasedEmail,
} from "../../email/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeCycle = (raw) => {
  const upper = String(raw || "MONTHLY").toUpperCase();
  if (upper === "ANNUAL" || upper === "YEARLY") return "ANNUAL";
  if (upper === "QUARTERLY") return "QUARTERLY";
  if (upper === "ONE_TIME") return "ONE_TIME";
  return "MONTHLY";
};

/**
 * Generates PDF for an Invoice record, updates invoice.pdfUrl & payment.invoiceUrl,
 * and sends the invoice email (non-throwing).
 */
const finalizeInvoicePdfAndEmail = async ({
  invoice,
  payment,
  tenant,
  periodEnd,
}) => {
  try {
    const settings = await getInvoiceSettings();
    const { filePath, fileUrl } = await generateInvoicePDF(
      invoice,
      tenant,
      settings,
    );

    await Promise.all([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl: fileUrl },
      }),
      payment?.id
        ? prisma.payment.update({
            where: { id: payment.id },
            data: { invoiceUrl: fileUrl },
          })
        : Promise.resolve(),
    ]);

    if (tenant?.email) {
      await sendInvoiceEmail(tenant.email, {
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        planName: invoice.planName,
        periodEnd: periodEnd ? new Date(periodEnd).toLocaleDateString() : "N/A",
        pdfPath: filePath,
      });
    }
  } catch (pdfErr) {
    console.error(
      "[RazorpayWebhook] Invoice PDF generation or email failed:",
      pdfErr.message,
    );
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret || !signature) {
      return res.status(400).send("Webhook secret or signature missing");
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(
        req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body),
      )
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");

    if (
      expectedBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, sigBuf)
    ) {
      console.warn("[RazorpayWebhook] Invalid Razorpay Webhook Signature");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;
    console.log(`[RazorpayWebhook] Verified event received: ${event}`);

    // ─────────────────────────────────────────────────────────────
    // 1. EVENT: One-Time Order Paid (order.paid / payment.captured)
    //    Handles purchaseType: PLAN | ADDON | TOPUP
    // ─────────────────────────────────────────────────────────────
    if (event === "order.paid" || event === "payment.captured") {
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (!orderId) {
        return res.status(200).json({ status: "skipped_no_order_id" });
      }

      const existingPayment = await prisma.payment.findFirst({
        where: { razorpayOrderId: orderId },
        include: {
          tenant: {
            include: {
              subscription: {
                include: { plan: true },
              },
            },
          },
          addOn: true,
        },
      });

      if (!existingPayment || existingPayment.status === "SUCCESS") {
        return res.status(200).json({ status: "ok", alreadyProcessed: true });
      }

      const now = new Date();
      const tenant = existingPayment.tenant;
      const sub = tenant?.subscription || null;
      const purchaseType = existingPayment.purchaseType || "PLAN";
      const gstCalc = await calculateGST(existingPayment.baseAmount);
      const invoiceNumber = await generateInvoiceNumber();

      // ── 1A. Base Plan Order ──
      if (purchaseType === "PLAN") {
        const targetPlan = existingPayment.planId
          ? await prisma.subscriptionPlan.findUnique({
              where: { id: existingPayment.planId },
            })
          : null;

        const billingCycle = normalizeCycle(existingPayment.billingType);
        const isSameActivePlan =
          sub &&
          sub.planId === existingPayment.planId &&
          sub.billingCycle === billingCycle &&
          sub.subscriptionStatus === "active" &&
          sub.planPeriodEnd &&
          new Date(sub.planPeriodEnd) > now;

        let periodStart = now;
        let periodEnd = calculatePeriodEnd(now, billingCycle);

        if (isSameActivePlan) {
          // Mid-cycle same-plan renewal keeps existing planPeriodStart anchor so monthly usage does not reset
          periodStart = sub.planPeriodStart
            ? new Date(sub.planPeriodStart)
            : now;
          periodEnd = calculatePeriodEnd(
            new Date(sub.planPeriodEnd),
            billingCycle,
          );
        } else if (sub?.graceDebtDays > 0 && targetPlan) {
          // Evaluate grace debt forgiveness (upgrade) vs deduction (same/downgrade)
          const newMonthlyEquiv = getMonthlyEquivalentPrice(
            targetPlan,
            billingCycle,
          );
          const oldMonthlyEquiv =
            sub.graceDebtPlanPrice ??
            (sub.plan
              ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle)
              : 0);

          if (newMonthlyEquiv <= oldMonthlyEquiv) {
            const deductedMs =
              periodEnd.getTime() - sub.graceDebtDays * DAY_MS;
            const minEndMs = now.getTime() + DAY_MS;
            periodEnd = new Date(Math.max(deductedMs, minEndMs));
          }
        }

        const { updatedPayment, createdInvoice } = await prisma.$transaction(
          async (tx) => {
            const p = await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: "SUCCESS",
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                paidAt: now,
                paymentMethod: paymentEntity?.method || "card",
              },
            });

            await tx.tenant.update({
              where: { id: existingPayment.tenantId },
              data: { status: "APPROVED" },
            });

            await tx.tenantSubscription.upsert({
              where: { tenantId: existingPayment.tenantId },
              update: {
                planId: existingPayment.planId,
                currentPlan: existingPayment.planName,
                billingCycle,
                subscriptionStatus: "active",
                planActivatedAt: isSameActivePlan
                  ? sub.planActivatedAt || now
                  : now,
                planPeriodStart: periodStart,
                planPeriodEnd: periodEnd,
                pendingPlanId: null,
                pendingBillingCycle: null,
                gracePeriodEnd: null,
                graceDebtDays: 0,
                graceDebtPlanPrice: null,
                cancelRequestedAt: null,
                cancellationReason: null,
                dataDeletionDate: null,
              },
              create: {
                tenantId: existingPayment.tenantId,
                planId: existingPayment.planId,
                currentPlan: existingPayment.planName,
                billingCycle,
                subscriptionStatus: "active",
                planActivatedAt: now,
                planPeriodStart: periodStart,
                planPeriodEnd: periodEnd,
              },
            });

            const inv = await tx.invoice.create({
              data: {
                tenantId: existingPayment.tenantId,
                invoiceNumber,
                purchaseType: "PLAN",
                planName: existingPayment.planName,
                amount: existingPayment.totalAmount,
                billingCycle,
                paymentId: p.id,
                baseAmount: existingPayment.baseAmount,
                gstEnabled: (existingPayment.gstAmount || 0) > 0,
                gstPercent: existingPayment.gstPercent ?? gstCalc.gstPercent,
                gstAmount: existingPayment.gstAmount ?? gstCalc.gstAmount,
                currency: existingPayment.currency || "INR",
                status: "paid",
                billingPeriodStart: periodStart,
                billingPeriodEnd: periodEnd,
                paymentMethodBrand:
                  paymentEntity?.method?.toUpperCase() || "ONLINE",
                paymentMethodLast4: paymentEntity?.card?.last4 || null,
              },
            });

            return { updatedPayment: p, createdInvoice: inv };
          },
        );

        await finalizeInvoicePdfAndEmail({
          invoice: createdInvoice,
          payment: updatedPayment,
          tenant,
          periodEnd,
        });
      }

      // ── 1B. Recurring Add-On Order ──
      else if (purchaseType === "ADDON" && existingPayment.addOn) {
        const addOn = existingPayment.addOn;
        const cycle = normalizeCycle(
          addOn.billingCycle || existingPayment.billingType,
        );
        const startsAt = now;
        const expiresAt = calculatePeriodEnd(now, cycle);

        const { updatedPayment, createdInvoice } = await prisma.$transaction(
          async (tx) => {
            const p = await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: "SUCCESS",
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                paidAt: now,
                paymentMethod: paymentEntity?.method || "card",
              },
            });

            await tx.tenantAddOn.create({
              data: {
                tenantId: existingPayment.tenantId,
                addOnId: addOn.id,
                status: "active",
                source: "PURCHASE",
                quantity: 1,
                startsAt,
                expiresAt,
              },
            });

            const inv = await tx.invoice.create({
              data: {
                tenantId: existingPayment.tenantId,
                invoiceNumber,
                purchaseType: "ADDON",
                addOnId: addOn.id,
                planName: addOn.name,
                amount: existingPayment.totalAmount,
                billingCycle: cycle,
                paymentId: p.id,
                baseAmount: existingPayment.baseAmount,
                gstEnabled: (existingPayment.gstAmount || 0) > 0,
                gstPercent: existingPayment.gstPercent ?? gstCalc.gstPercent,
                gstAmount: existingPayment.gstAmount ?? gstCalc.gstAmount,
                currency: existingPayment.currency || "INR",
                status: "paid",
                billingPeriodStart: startsAt,
                billingPeriodEnd: expiresAt,
                paymentMethodBrand:
                  paymentEntity?.method?.toUpperCase() || "ONLINE",
                paymentMethodLast4: paymentEntity?.card?.last4 || null,
              },
            });

            return { updatedPayment: p, createdInvoice: inv };
          },
        );

        await finalizeInvoicePdfAndEmail({
          invoice: createdInvoice,
          payment: updatedPayment,
          tenant,
          periodEnd: expiresAt,
        });

        if (tenant?.email) {
          sendAddonPurchasedEmail({
            toEmail: tenant.email,
            tenantName: tenant.tenantName,
            addonName: addOn.name,
            addonType: "RECURRING",
            quantity: 1,
            amountPaid: existingPayment.totalAmount,
            expiresAt,
          }).catch(() => {});
        }
      }

      // ── 1C. One-Time Credit Top-Up Order ──
      else if (purchaseType === "TOPUP" && existingPayment.addOn) {
        const addOn = existingPayment.addOn;
        const creditAmount = Math.max(1, Number(addOn.entitlementValue) || 0);

        const { updatedPayment, createdInvoice } = await prisma.$transaction(
          async (tx) => {
            const p = await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: "SUCCESS",
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                paidAt: now,
                paymentMethod: paymentEntity?.method || "card",
              },
            });

            await grantCredits(
              existingPayment.tenantId,
              addOn.entitlementKey,
              creditAmount,
              tx,
            );

            const inv = await tx.invoice.create({
              data: {
                tenantId: existingPayment.tenantId,
                invoiceNumber,
                purchaseType: "TOPUP",
                addOnId: addOn.id,
                planName: addOn.name,
                amount: existingPayment.totalAmount,
                billingCycle: "ONE_TIME",
                paymentId: p.id,
                baseAmount: existingPayment.baseAmount,
                gstEnabled: (existingPayment.gstAmount || 0) > 0,
                gstPercent: existingPayment.gstPercent ?? gstCalc.gstPercent,
                gstAmount: existingPayment.gstAmount ?? gstCalc.gstAmount,
                currency: existingPayment.currency || "INR",
                status: "paid",
                billingPeriodStart: now,
                billingPeriodEnd: now,
                paymentMethodBrand:
                  paymentEntity?.method?.toUpperCase() || "ONLINE",
                paymentMethodLast4: paymentEntity?.card?.last4 || null,
              },
            });

            return { updatedPayment: p, createdInvoice: inv };
          },
        );

        await finalizeInvoicePdfAndEmail({
          invoice: createdInvoice,
          payment: updatedPayment,
          tenant,
          periodEnd: now,
        });

        if (tenant?.email) {
          sendAddonPurchasedEmail({
            toEmail: tenant.email,
            tenantName: tenant.tenantName,
            addonName: addOn.name,
            addonType: "ONE_TIME_TOPUP",
            quantity: 1,
            creditsGranted: creditAmount,
            amountPaid: existingPayment.totalAmount,
          }).catch(() => {});
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. EVENT: Subscription Mandate Authenticated / Activated
    // ─────────────────────────────────────────────────────────────
    else if (
      event === "subscription.authenticated" ||
      event === "subscription.activated"
    ) {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        await prisma.tenantSubscription.updateMany({
          where: {
            razorpaySubscriptionId: subscription.id,
            autopayEnabled: false,
          },
          data: {
            autopayEnabled: true,
            autopayMethod: subscription.payment_method || "card",
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. EVENT: Recurring Subscription Charged (Base Plan or Add-On)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.charged") {
      const subscription = req.body?.payload?.subscription?.entity;
      const payment = req.body?.payload?.payment?.entity;

      if (subscription?.id && payment?.id) {
        const duplicatePayment = await prisma.payment.findUnique({
          where: { razorpayPaymentId: payment.id },
        });
        if (duplicatePayment) {
          return res.status(200).json({ status: "ok", duplicate: true });
        }

        const now = new Date();
        const periodStart = subscription.current_start
          ? new Date(subscription.current_start * 1000)
          : now;

        // Check Base Plan Subscription first
        const subRecord = await prisma.tenantSubscription.findFirst({
          where: { razorpaySubscriptionId: subscription.id },
          include: {
            tenant: true,
            plan: true,
            pendingPlan: true,
          },
        });

        if (subRecord) {
          // Apply valid pendingPlan if scheduled for period end
          const activePlan =
            subRecord.pendingPlan && subRecord.pendingPlan.status === "ACTIVE"
              ? subRecord.pendingPlan
              : subRecord.plan;
          const activeCycle =
            subRecord.pendingPlan && subRecord.pendingPlan.status === "ACTIVE"
              ? subRecord.pendingBillingCycle || subRecord.billingCycle
              : subRecord.billingCycle || "MONTHLY";

          const periodEnd = subscription.current_end
            ? new Date(subscription.current_end * 1000)
            : calculatePeriodEnd(periodStart, activeCycle);

          const totalAmount = (payment.amount || 0) / 100;
          const gstCalc = await calculateGST(totalAmount);
          const invoiceNumber = await generateInvoiceNumber();
          const planLabel =
            activePlan?.name || subRecord.currentPlan || "Active Plan";

          const { updatedPayment, createdInvoice } = await prisma.$transaction(
            async (tx) => {
              await tx.tenant.update({
                where: { id: subRecord.tenantId },
                data: { status: "APPROVED" },
              });

              await tx.tenantSubscription.update({
                where: { tenantId: subRecord.tenantId },
                data: {
                  planId: activePlan?.id ?? subRecord.planId,
                  currentPlan: planLabel,
                  billingCycle: activeCycle,
                  pendingPlanId: null,
                  pendingBillingCycle: null,
                  subscriptionStatus: "active",
                  planPeriodStart: periodStart,
                  planPeriodEnd: periodEnd,
                  gracePeriodEnd: null,
                  graceDebtDays: 0,
                  graceDebtPlanPrice: null,
                  dataDeletionDate: null,
                  cancelRequestedAt: null,
                  cancellationReason: null,
                  autopayEnabled: true,
                },
              });

              const p = await tx.payment.create({
                data: {
                  tenantId: subRecord.tenantId,
                  razorpayOrderId: payment.order_id || null,
                  razorpayPaymentId: payment.id,
                  razorpaySignature: signature,
                  paymentType: "ONLINE",
                  purchaseType: "PLAN",
                  planId: activePlan?.id || subRecord.planId,
                  planName: planLabel,
                  billingType: activeCycle,
                  baseAmount: gstCalc.baseAmount,
                  gstPercent: gstCalc.gstPercent ?? 18,
                  gstAmount: gstCalc.gstAmount ?? 0,
                  totalAmount,
                  currency: payment.currency || "INR",
                  paymentMethod: payment.method || "card",
                  status: "SUCCESS",
                  paidAt: payment.created_at
                    ? new Date(payment.created_at * 1000)
                    : now,
                },
              });

              const inv = await tx.invoice.create({
                data: {
                  tenantId: subRecord.tenantId,
                  invoiceNumber,
                  purchaseType: "PLAN",
                  planName: planLabel,
                  amount: totalAmount,
                  billingCycle: activeCycle,
                  paymentId: p.id,
                  baseAmount: gstCalc.baseAmount,
                  gstAmount: gstCalc.gstAmount,
                  gstPercent: gstCalc.gstPercent,
                  status: "paid",
                  currency: payment.currency || "INR",
                  billingPeriodStart: periodStart,
                  billingPeriodEnd: periodEnd,
                  paymentMethodBrand:
                    payment.method?.toUpperCase() || "AUTOPAY",
                  paymentMethodLast4: payment.card?.last4 || null,
                },
              });

              return { updatedPayment: p, createdInvoice: inv };
            },
          );

          await finalizeInvoicePdfAndEmail({
            invoice: createdInvoice,
            payment: updatedPayment,
            tenant: subRecord.tenant,
            periodEnd,
          });
        } else {
          // Check Recurring TenantAddOn Subscription
          const tenantAddOn = await prisma.tenantAddOn.findFirst({
            where: { razorpaySubscriptionId: subscription.id },
            include: { tenant: true, addOn: true },
          });

          if (tenantAddOn && tenantAddOn.addOn) {
            const addOnCycle =
              tenantAddOn.addOn.billingCycle || "MONTHLY";
            const periodEnd = subscription.current_end
              ? new Date(subscription.current_end * 1000)
              : calculatePeriodEnd(periodStart, addOnCycle);
            const totalAmount = (payment.amount || 0) / 100;
            const gstCalc = await calculateGST(totalAmount);
            const invoiceNumber = await generateInvoiceNumber();

            const { updatedPayment, createdInvoice } =
              await prisma.$transaction(async (tx) => {
                await tx.tenantAddOn.update({
                  where: { id: tenantAddOn.id },
                  data: {
                    status: "active",
                    expiresAt: periodEnd,
                  },
                });

                const p = await tx.payment.create({
                  data: {
                    tenantId: tenantAddOn.tenantId,
                    razorpayOrderId: payment.order_id || null,
                    razorpayPaymentId: payment.id,
                    razorpaySignature: signature,
                    paymentType: "ONLINE",
                    purchaseType: "ADDON",
                    addOnId: tenantAddOn.addOn.id,
                    planName: tenantAddOn.addOn.name,
                    billingType: addOnCycle,
                    baseAmount: gstCalc.baseAmount,
                    gstPercent: gstCalc.gstPercent ?? 18,
                    gstAmount: gstCalc.gstAmount ?? 0,
                    totalAmount,
                    currency: payment.currency || "INR",
                    paymentMethod: payment.method || "card",
                    status: "SUCCESS",
                    paidAt: payment.created_at
                      ? new Date(payment.created_at * 1000)
                      : now,
                  },
                });

                const inv = await tx.invoice.create({
                  data: {
                    tenantId: tenantAddOn.tenantId,
                    invoiceNumber,
                    purchaseType: "ADDON",
                    addOnId: tenantAddOn.addOn.id,
                    planName: tenantAddOn.addOn.name,
                    amount: totalAmount,
                    billingCycle: addOnCycle,
                    paymentId: p.id,
                    baseAmount: gstCalc.baseAmount,
                    gstAmount: gstCalc.gstAmount,
                    gstPercent: gstCalc.gstPercent,
                    status: "paid",
                    currency: payment.currency || "INR",
                    billingPeriodStart: periodStart,
                    billingPeriodEnd: periodEnd,
                    paymentMethodBrand:
                      payment.method?.toUpperCase() || "AUTOPAY",
                    paymentMethodLast4: payment.card?.last4 || null,
                  },
                });

                return { updatedPayment: p, createdInvoice: inv };
              });

            await finalizeInvoicePdfAndEmail({
              invoice: createdInvoice,
              payment: updatedPayment,
              tenant: tenantAddOn.tenant,
              periodEnd,
            });
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. EVENT: Subscription Halted / Auto-Debit Failed -> Enter Grace Period
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.halted") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        const subRecord = await prisma.tenantSubscription.findFirst({
          where: { razorpaySubscriptionId: subscription.id },
          include: { tenant: true, plan: true },
        });

        if (subRecord) {
          const settings = await prisma.platformSettings.findFirst();
          const graceDays =
            subRecord.gracePeriodDays ?? settings?.defaultGraceDays ?? 7;
          const now = new Date();
          const gracePeriodEnd = new Date(now.getTime() + graceDays * DAY_MS);
          const monthlyEquivPrice = subRecord.plan
            ? getMonthlyEquivalentPrice(subRecord.plan, subRecord.billingCycle)
            : subRecord.graceDebtPlanPrice ?? null;

          await prisma.tenantSubscription.update({
            where: { tenantId: subRecord.tenantId },
            data: {
              subscriptionStatus: "payment_failed",
              gracePeriodEnd,
              graceDebtPlanPrice: monthlyEquivPrice,
            },
          });

          if (subRecord.tenant?.email) {
            sendGracePeriodStartedEmail({
              toEmail: subRecord.tenant.email,
              tenantName: subRecord.tenant.tenantName,
              planName:
                subRecord.plan?.name || subRecord.currentPlan || "Subscription",
              graceDays,
              gracePeriodEnd,
            }).catch(() => {});
          }
        } else {
          await prisma.tenantAddOn.updateMany({
            where: { razorpaySubscriptionId: subscription.id },
            data: { status: "expired" },
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. EVENT: Subscription Pending
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.pending") {
      const subscription = req.body?.payload?.subscription?.entity;
      console.log(
        `[RazorpayWebhook] Subscription ${subscription?.id} is pending mandate approval`,
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 6. EVENT: Subscription Completed (End of Total Cycles)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.completed") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        await prisma.tenantSubscription.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: { autopayEnabled: false },
        });
        await prisma.tenantAddOn.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: { status: "cancel_at_period_end" },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7. EVENT: Subscription Cancelled
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.cancelled") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        await prisma.tenantSubscription.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: false,
            cancelRequestedAt: new Date(),
          },
        });
        await prisma.tenantAddOn.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: { status: "cancel_at_period_end" },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7A. EVENT: Subscription Paused
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.paused") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        await prisma.tenantSubscription.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: false,
            subscriptionStatus: "paused",
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7B. EVENT: Subscription Resumed
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.resumed") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        await prisma.tenantSubscription.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: true,
            subscriptionStatus: "active",
            gracePeriodEnd: null,
            dataDeletionDate: null,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 8. EVENT: Payment Failed (payment.failed)
    // ─────────────────────────────────────────────────────────────
    else if (event === "payment.failed") {
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const existingPayment = await prisma.payment.findFirst({
          where: { razorpayOrderId: orderId },
        });

        if (existingPayment && existingPayment.status === "PENDING") {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: "FAILED",
              razorpayPaymentId: paymentId || existingPayment.razorpayPaymentId,
            },
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 9. EVENT: Refund Processed (refund.processed / refund.created)
    // ─────────────────────────────────────────────────────────────
    else if (event === "refund.processed" || event === "refund.created") {
      const refundEntity = req.body?.payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;

      if (paymentId) {
        const existingPayment = await prisma.payment.findFirst({
          where: { razorpayPaymentId: paymentId },
        });

        if (existingPayment) {
          await prisma.$transaction([
            prisma.payment.update({
              where: { id: existingPayment.id },
              data: { status: "REFUNDED" },
            }),
            prisma.invoice.updateMany({
              where: { paymentId: existingPayment.id },
              data: { status: "refunded" },
            }),
          ]);
        }
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("[RazorpayWebhook] Error:", error);
    return res.status(500).send("Internal server error");
  }
};
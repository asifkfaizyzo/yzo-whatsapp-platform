import crypto from "crypto";
import prisma from "../../config/prisma.js";
import { calculateGST } from "../superadmin/superadminService.js";
import { generateInvoicePDF } from "../plans/invoiceService.js";
import { sendInvoiceEmail } from "../auth/emailService.js";

import { createSuperAdminNotification } from "../SuperAdminNotifications/superAdminNotificationService.js";
import { createNotification } from "../notifications/notificationService.js";
import { emitToSuperAdmin, emitToTenant } from "../../lib/socket.js";

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret || !signature) {
      return res.status(400).send("Webhook secret or signature missing");
    }

    if (!req.rawBody) {
      console.warn("⚠️ Webhook rawBody missing on request");
    }

    // Verify Signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body))
      .digest("hex");

    // Safe constant-time comparison
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      console.warn("⚠️ Invalid Razorpay Webhook Signature");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;
    console.log(`🔔 Verified Razorpay Webhook received: ${event}`);

    // ─────────────────────────────────────────────────────────────
    // 1. EVENT: Payment Success (order.paid / payment.captured)
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
        include: { tenant: true },
      });

      if (existingPayment && existingPayment.status !== "SUCCESS") {
        console.log(`[Webhook] Auto-activating plan for order: ${orderId}`);

        const gstCalc = await calculateGST(existingPayment.baseAmount);
        const tenant = existingPayment.tenant;

        // Calculate billing period dates (accounting for active plan extension)
        const isSamePlan = tenant?.planId === existingPayment.planId;
        const isSameBillingType = tenant?.billingType === existingPayment.billingType;
        const isCurrentPlanActive =
          tenant?.subscriptionStatus === "active" ||
          tenant?.subscriptionStatus === "cancel_at_period_end";
        const isNotExpired =
          tenant?.planPeriodEnd && new Date(tenant.planPeriodEnd) > new Date();

        let periodStart = new Date();
        let periodEnd = new Date(periodStart);

        if (existingPayment.billingType === "annual") {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        const wasExtended =
          isSamePlan && isSameBillingType && isCurrentPlanActive && isNotExpired;

        if (wasExtended && tenant.planPeriodEnd) {
          periodStart = new Date(tenant.planPeriodEnd);
          const existingEnd = new Date(tenant.planPeriodEnd);
          if (existingPayment.billingType === "annual") {
            existingEnd.setFullYear(existingEnd.getFullYear() + 1);
          } else {
            existingEnd.setMonth(existingEnd.getMonth() + 1);
          }
          periodEnd = existingEnd;
        }

        // Atomic transaction to update payment and tenant plan
        const { updatedPayment } = await prisma.$transaction(async (tx) => {
          const p = await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: "SUCCESS",
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
              paidAt: new Date(),
              paymentMethod: paymentEntity?.method || "card",
            },
          });

          await tx.tenant.update({
            where: { id: existingPayment.tenantId },
            data: {
              planId: existingPayment.planId,
              currentPlan: existingPayment.planName,
              billingType: existingPayment.billingType,
              planStatus: "active",
              subscriptionStatus: "active",
              status: "APPROVED",
              planActivatedAt: periodStart,
              planPeriodStart: periodStart,
              planPeriodEnd: periodEnd,
              cancelRequestedAt: null,
              cancellationReason: null,
              dataDeletionDate: null,
            },
          });

          return { updatedPayment: p };
        });

        // Generate Invoice PDF
        try {
          const { filePath, fileUrl, invoiceNumber } = await generateInvoicePDF(
            updatedPayment,
            tenant
          );

          await prisma.payment.update({
            where: { id: updatedPayment.id },
            data: { invoiceUrl: fileUrl },
          });

          await sendInvoiceEmail(tenant.email, {
            invoiceNumber,
            amount: updatedPayment.totalAmount,
            planName: updatedPayment.planName,
            periodEnd: periodEnd.toLocaleDateString(),
            pdfPath: filePath,
          });
        } catch (pdfErr) {
          console.error("❌ PDF generation or email failed in webhook:", pdfErr.message);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. EVENT: Recurring Subscription Authenticated (Mandate Active)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.authenticated") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        console.log(`[Webhook] Mandate authenticated for subscription: ${subscription.id}`);
        await prisma.tenant.updateMany({
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
    // 3. EVENT: Recurring Subscription Charged (Day 15 Renewal / Monthly)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.charged") {
      const subscription = req.body?.payload?.subscription?.entity;
      const payment = req.body?.payload?.payment?.entity;

      if (subscription?.id && payment?.id) {
        // Idempotency Guard: Check if payment already processed
        const existingPayment = await prisma.payment.findUnique({
          where: { razorpayPaymentId: payment.id },
        });

        if (existingPayment) {
          console.log(`[Webhook] Duplicate subscription.charged event for payment ${payment.id} — skipping`);
          return res.status(200).json({ status: "ok", duplicate: true });
        }

        const tenant = await prisma.tenant.findFirst({
          where: { razorpaySubscriptionId: subscription.id },
          include: { plan: true },
        });

        if (tenant) {
          console.log(`[Webhook] Processing recurring renewal for tenant ${tenant.tenantName} (${tenant.id})`);
          const periodStart = new Date(subscription.current_start * 1000);
          const periodEnd = new Date(subscription.current_end * 1000);
          const totalAmount = payment.amount / 100;
          const planBase = tenant.plan?.monthlyPrice || totalAmount;
          const gstCalc = await calculateGST(planBase);
          const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

          const { updatedPayment } = await prisma.$transaction(async (tx) => {
            // A. Update Tenant to Active
            await tx.tenant.update({
              where: { id: tenant.id },
              data: {
                subscriptionStatus: "active",
                planStatus: "active",
                status: "APPROVED",
                planPeriodStart: periodStart,
                planPeriodEnd: periodEnd,
                dataDeletionDate: null,
                cancelRequestedAt: null,
                cancellationReason: null,
                autopayEnabled: true,
              },
            });

            // B. Create Payment Record
            const p = await tx.payment.create({
              data: {
                tenantId: tenant.id,
                razorpayOrderId: payment.order_id || null,
                razorpayPaymentId: payment.id,
                razorpaySignature: signature,
                paymentType: "ONLINE",
                planId: tenant.planId || "unknown",
                planName: tenant.currentPlan || tenant.plan?.name || "Active Plan",
                billingType: tenant.billingType || "monthly",
                baseAmount: gstCalc.baseAmount,
                gstPercent: gstCalc.gstPercent || 18,
                gstAmount: gstCalc.gstAmount || 0,
                totalAmount: totalAmount,
                currency: payment.currency || "INR",
                paymentMethod: payment.method || "card",
                status: "SUCCESS",
                paidAt: new Date(payment.created_at * 1000),
              },
            });

            // C. Create Invoice Record
            await tx.invoice.create({
              data: {
                tenantId: tenant.id,
                invoiceNumber,
                planName: tenant.currentPlan || tenant.plan?.name || "Active Plan",
                amount: totalAmount,
                baseAmount: gstCalc.baseAmount,
                gstAmount: gstCalc.gstAmount,
                gstPercent: gstCalc.gstPercent,
                status: "paid",
                currency: payment.currency || "INR",
                billingPeriodStart: periodStart,
                billingPeriodEnd: periodEnd,
                paymentMethodBrand: payment.method?.toUpperCase() || "AUTOPAY",
                paymentMethodLast4: payment.card?.last4 || null,
              },
            });

            return { updatedPayment: p };
          });

          // Generate Invoice PDF & Email
          try {
            const { filePath, fileUrl } = await generateInvoicePDF(updatedPayment, tenant);
            await prisma.payment.update({
              where: { id: updatedPayment.id },
              data: { invoiceUrl: fileUrl },
            });

            await sendInvoiceEmail(tenant.email, {
              invoiceNumber,
              amount: totalAmount,
              planName: tenant.currentPlan || "Active Plan",
              periodEnd: periodEnd.toLocaleDateString(),
              pdfPath: filePath,
            });
          } catch (pdfErr) {
            console.error("❌ PDF generation or email failed for subscription.charged:", pdfErr.message);
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. EVENT: Subscription Halted / Failed Auto-Debit (Soft Lock)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.halted") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        console.warn(`[Webhook] Subscription ${subscription.id} halted / auto-debit failed.`);
        await prisma.tenant.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            subscriptionStatus: "payment_failed",
            planStatus: "inactive",
            // Do NOT set dataDeletionDate yet — Razorpay will retry over 3-5 days
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. EVENT: Subscription Pending (Waiting for mandate)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.pending") {
      const subscription = req.body?.payload?.subscription?.entity;
      console.log(`[Webhook] Subscription ${subscription?.id} is pending mandate approval`);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. EVENT: Subscription Completed (End of Total Cycles)
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.completed") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        console.log(`[Webhook] Subscription ${subscription.id} reached term completion`);
        await prisma.tenant.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: false,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7. EVENT: Subscription Cancelled
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.cancelled") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        console.log(`[Webhook] Subscription ${subscription.id} cancelled`);
        await prisma.tenant.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: false,
            subscriptionStatus: "cancel_at_period_end",
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7A. EVENT: Subscription Paused
    // ─────────────────────────────────────────────────────────────
    else if (event === "subscription.paused") {
      const subscription = req.body?.payload?.subscription?.entity;
      if (subscription?.id) {
        console.log(`[Webhook] Subscription ${subscription.id} paused`);
        await prisma.tenant.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: false,
            subscriptionStatus: "paused",
            planStatus: "inactive",
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
        console.log(`[Webhook] Subscription ${subscription.id} resumed`);
        await prisma.tenant.updateMany({
          where: { razorpaySubscriptionId: subscription.id },
          data: {
            autopayEnabled: true,
            subscriptionStatus: "active",
            planStatus: "active",
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
          console.warn(`[Webhook] Marking payment as FAILED for order: ${orderId}`);
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
          console.log(`[Webhook] Payment ${paymentId} marked as REFUNDED`);
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: { status: "REFUNDED" },
          });
        }
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).send("Internal server error");
  }
};
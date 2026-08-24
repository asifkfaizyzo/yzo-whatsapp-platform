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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
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

      const existingPayment = await prisma.payment.findUnique({
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
              razorpayPaymentId: paymentId || existingPayment.razorpayPaymentId,
              paymentMethod: paymentEntity?.method || existingPayment.paymentMethod,
              paidAt: new Date(),
              gstPercent: gstCalc.gstPercent,
              gstAmount: gstCalc.gstAmount,
              totalAmount: gstCalc.totalAmount,
            },
          });

          await tx.tenant.update({
            where: { id: existingPayment.tenantId },
            data: {
              planId: existingPayment.planId,
              planActivatedAt: periodStart,
              billingType: existingPayment.billingType,
              planStatus: "active",
              status: "APPROVED",
              subscriptionStatus: "active",
              currentPlan: existingPayment.planName,
              planPeriodStart: periodStart,
              planPeriodEnd: periodEnd,
              cancelRequestedAt: null,
              cancellationReason: null,
              dataDeletionDate: null,
            },
          });

          return { updatedPayment: p };
        });

        console.log(`[Webhook] Plan activated successfully for tenant ${existingPayment.tenantId}`);
        
        // ── Format amount & label for display ──
        const amountDisplay = `₹${((existingPayment.totalAmount || existingPayment.baseAmount) / 100).toLocaleString("en-IN")}`;
        const planLabel = `${existingPayment.planName} (${existingPayment.billingType})`;

        // ✅ 1. Notify SuperAdmin about successful payment
        try {
          const superAdminNotif = await createSuperAdminNotification({
            type: "tenant_payment",
            title: "💳 Payment Received",
            message: `${tenant?.tenantName || "A tenant"} paid ${amountDisplay} for ${planLabel}`,
            metadata: {
              tenantId: existingPayment.tenantId,
              tenantName: tenant?.tenantName,
              tenantEmail: tenant?.email,
              planName: existingPayment.planName,
              billingType: existingPayment.billingType,
              amount: existingPayment.totalAmount || existingPayment.baseAmount,
              orderId,
              paymentId,
            },
          });

          emitToSuperAdmin("superadmin_notification", {
            notification: {
              id: superAdminNotif.id,
              type: superAdminNotif.type,
              title: superAdminNotif.title,
              message: superAdminNotif.message,
              isRead: superAdminNotif.isRead,
              createdAt: superAdminNotif.createdAt,
              metadata: superAdminNotif.metadata,
            },
          });
          console.log(`📤 SuperAdmin payment notification emitted: ${superAdminNotif.id}`);
        } catch (err) {
          console.error("❌ SuperAdmin payment notification failed:", err.message);
        }

        // ✅ 2. Notify Tenant about plan activation
        if (tenant) {
          try {
            const tenantNotif = await createNotification({
              tenantId: existingPayment.tenantId,
              userId: null, // tenant-wide
              type: "plan_activated",
              title: "✅ Plan Activated",
              message: `Your ${planLabel} plan is now active. Valid until ${periodEnd.toLocaleDateString("en-IN")}`,
              metadata: {
                planName: existingPayment.planName,
                billingType: existingPayment.billingType,
                amount: existingPayment.totalAmount || existingPayment.baseAmount,
                periodEnd: periodEnd.toISOString(),
                orderId,
              },
            });

            emitToTenant(existingPayment.tenantId, "new_notification", {
              notification: {
                id: tenantNotif.id,
                type: tenantNotif.type,
                title: tenantNotif.title,
                message: tenantNotif.message,
                isRead: tenantNotif.isRead,
                createdAt: tenantNotif.createdAt,
                metadata: tenantNotif.metadata,
              },
            });

            // Emit live plan update event for dashboard banners
            emitToTenant(existingPayment.tenantId, "plan_activated", {
              planName: existingPayment.planName,
              billingType: existingPayment.billingType,
              subscriptionStatus: "active",
              planPeriodEnd: periodEnd.toISOString(),
            });

            console.log(`📤 Tenant plan notification emitted: ${tenantNotif.id}`);
          } catch (err) {
            console.error("❌ Tenant plan notification failed:", err.message);
          }
        }

        // Generate Invoice PDF & Send Email asynchronously
        if (tenant) {
          generateInvoicePDF(updatedPayment, tenant)
            .then(async ({ filePath, fileUrl, invoiceNumber }) => {
              await prisma.payment.update({
                where: { id: updatedPayment.id },
                data: { invoiceUrl: fileUrl },
              });
              await sendInvoiceEmail(
                tenant.email,
                tenant.tenantName || tenant.email,
                invoiceNumber,
                filePath
              );
            })
            .catch((err) => {
              console.error("❌ Webhook invoice generation error:", err.message);
            });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. EVENT: Payment Failed (payment.failed)
    // ─────────────────────────────────────────────────────────────
    else if (event === "payment.failed") {
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const existingPayment = await prisma.payment.findUnique({
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

          const tenant = await prisma.tenant.findUnique({
            where: { id: existingPayment.tenantId },
          });

          // ✅ Notify SuperAdmin
          try {
            const failedNotif = await createSuperAdminNotification({
              type: "tenant_payment_failed",
              title: "❌ Payment Failed",
              message: `${tenant?.tenantName || "A tenant"} payment failed for ${existingPayment.planName}`,
              metadata: {
                tenantId: existingPayment.tenantId,
                tenantName: tenant?.tenantName,
                tenantEmail: tenant?.email,
                planName: existingPayment.planName,
                orderId,
                paymentId,
              },
            });

            emitToSuperAdmin("superadmin_notification", {
              notification: {
                id: failedNotif.id,
                type: failedNotif.type,
                title: failedNotif.title,
                message: failedNotif.message,
                isRead: failedNotif.isRead,
                createdAt: failedNotif.createdAt,
                metadata: failedNotif.metadata,
              },
            });
          } catch (err) {
            console.error("❌ SuperAdmin payment failed notification error:", err.message);
          }

          // ✅ Notify Tenant
          if (tenant) {
            try {
              const tenantFailNotif = await createNotification({
                tenantId: existingPayment.tenantId,
                userId: null,
                type: "payment_failed",
                title: "❌ Payment Failed",
                message: `Your payment for ${existingPayment.planName} failed. Please try again.`,
                metadata: {
                  planName: existingPayment.planName,
                  orderId,
                },
              });

              emitToTenant(existingPayment.tenantId, "new_notification", {
                notification: {
                  id: tenantFailNotif.id,
                  type: tenantFailNotif.type,
                  title: tenantFailNotif.title,
                  message: tenantFailNotif.message,
                  isRead: tenantFailNotif.isRead,
                  createdAt: tenantFailNotif.createdAt,
                  metadata: tenantFailNotif.metadata,
                },
              });
            } catch (err) {
              console.error("❌ Tenant payment failed notification error:", err.message);
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. EVENT: Refund Processed (refund.processed / refund.created)
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
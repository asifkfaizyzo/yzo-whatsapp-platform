import crypto from "crypto";
import prisma from "../../config/prisma.js";
import { calculateGST } from "../superadmin/superadminService.js";
import { generateInvoicePDF } from "../plans/invoiceService.js";
import { sendInvoiceEmail } from "../auth/emailService.js";

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
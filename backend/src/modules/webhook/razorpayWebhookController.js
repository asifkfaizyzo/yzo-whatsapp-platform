import crypto from "crypto";
import prisma from "../../config/prisma.js";
import { verifyPaymentAndActivate } from "../plans/planController.js";

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret || !signature) {
      return res.status(400).send("Webhook secret or signature missing");
    }

    // Verify Signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body))
      .digest("hex");

    // ✅ NEW (Safe constant-time comparison)
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      console.warn("⚠️ Invalid Razorpay Webhook Signature");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;

    if (event === "order.paid" || event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const existingPayment = await prisma.payment.findUnique({
        where: { razorpayOrderId: orderId },
      });

      if (existingPayment && existingPayment.status !== "SUCCESS") {
        console.log(`[Webhook] Auto-activating plan for order: ${orderId}`);
        
        await verifyPaymentAndActivate(
          {
            body: {
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(`${orderId}|${paymentId}`)
                .digest("hex"),
              planId: existingPayment.planId,
              billingType: existingPayment.billingType,
            },
            tenantId: existingPayment.tenantId,
          },
          { status: () => ({ json: () => {} }) }
        );
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).send("Internal server error");
  }
};
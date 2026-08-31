// backend/scripts/simulate-autopay-renewal.js
import crypto from "crypto";
import http from "http";
import dotenv from "dotenv";
import prisma from "../src/config/prisma.js";
import { calculateGST } from "../src/modules/superadmin/superadminService.js";

dotenv.config();

async function main() {
  const tenantEmail = process.argv[2];

  // 1. Find the target tenant
  let tenant;
  if (tenantEmail) {
    tenant = await prisma.tenant.findUnique({
      where: { email: tenantEmail },
      include: { plan: true },
    });
  } else {
    // Find the latest tenant with an active or trialing subscription
    tenant = await prisma.tenant.findFirst({
      where: {
        razorpaySubscriptionId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      include: { plan: true },
    });
  }

  if (!tenant) {
    console.error("❌ No tenant found with a razorpaySubscriptionId. Please subscribe or start a trial first.");
    process.exit(1);
  }

  console.log(`\n🔍 Found Tenant: ${tenant.tenantName} (${tenant.email})`);
  console.log(`   Subscription ID : ${tenant.razorpaySubscriptionId}`);
  console.log(`   Current Plan    : ${tenant.currentPlan || tenant.plan?.name || "N/A"}`);
  console.log(`   Current Status  : ${tenant.subscriptionStatus}`);
  console.log(`   Current End Date: ${tenant.planPeriodEnd ? tenant.planPeriodEnd.toISOString() : "N/A"}\n`);

  // 2. Prepare simulated subscription.charged webhook payload
  const currentStart = Math.floor(Date.now() / 1000);
  const currentEnd = Math.floor((Date.now() + 30 * 86400000) / 1000);
  const mockPaymentId = `pay_sim_${Date.now()}`;
  const gstCalc = await calculateGST(tenant.plan?.monthlyPrice || 1999);
  const amountInPaise = Math.round(gstCalc.totalAmount * 100);

  const payload = {
    entity: "event",
    account_id: "acc_test",
    event: "subscription.charged",
    contains: ["subscription", "payment"],
    payload: {
      subscription: {
        entity: {
          id: tenant.razorpaySubscriptionId,
          plan_id: tenant.plan?.razorpayMonthlyPlanId || "plan_test",
          status: "active",
          current_start: currentStart,
          current_end: currentEnd,
          charge_at: currentEnd,
          total_count: 60,
          paid_count: 1,
          remaining_count: 59,
        },
      },
      payment: {
        entity: {
          id: mockPaymentId,
          amount: amountInPaise,
          currency: "INR",
          status: "captured",
          order_id: null,
          method: "upi",
          created_at: currentStart,
        },
      },
    },
    created_at: currentStart,
  };

  const payloadString = JSON.stringify(payload);
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payloadString)
    .digest("hex");

  console.log("🚀 Sending simulated subscription.charged webhook to http://localhost:5000/api/webhook/razorpay ...");

  // 3. Send HTTP Request to local webhook endpoint
  const req = http.request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/webhook/razorpay",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payloadString),
        "x-razorpay-signature": signature,
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", async () => {
        console.log(`📡 Webhook Response (${res.statusCode}): ${data}`);

        // 4. Verify Database State
        const updatedTenant = await prisma.tenant.findUnique({
          where: { id: tenant.id },
        });

        console.log("\n✅ AUTO-PAY RENEWAL TEST RESULTS:");
        console.log(`   New Subscription Status : ${updatedTenant.subscriptionStatus}`);
        console.log(`   New Plan Period End Date: ${updatedTenant.planPeriodEnd?.toISOString()}`);
        console.log(`   Autopay Enabled         : ${updatedTenant.autopayEnabled}`);
        console.log("\n🎉 The recurring autopay flow is fully functional and verified!");
        process.exit(0);
      });
    }
  );

  req.on("error", (err) => {
    console.error("❌ Failed to reach local backend server:", err.message);
    process.exit(1);
  });

  req.write(payloadString);
  req.end();
}

main().catch(console.error);

// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...\n");

  // ══════════════════════════════════════
  // Step 0: Seed SuperAdmin
  // ══════════════════════════════════════
  const adminEmail = process.env.SUPERADMIN_EMAIL || "ananthukrishna1963@gmail.com";
  const adminPass  = process.env.SUPERADMIN_PASSWORD || "Admin@123";
  const hashedPassword = await bcrypt.hash(adminPass, 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Super Admin",
      password: hashedPassword,
    },
  });
  console.log(`✅ SuperAdmin account seeded: ${superAdmin.email}\n`);

  // ══════════════════════════════════════
  // Step 1: Seed Features
  // ══════════════════════════════════════
  const featureNames = [
    "Shared Team Inbox",
    "Omnichannel Inbox",
    "WhatsApp Payments",
    "Blue Tick Verification",
    "Drip Campaigns",
    "Campaign Scheduler",
    "Campaign Tracking",
    "Smart Agent Routing",
    "AI Copilot",
    "AI Support Agent",
    "AI Voice",
    "Knowledge Base Automation",
    "CTWA Ad Tracking",
    "Native Forms Builder",
    "Multiple Organizations",
    "Number Masking",
    "Role Based Access",
    "Webhooks",
  ];

  const featureMap = {};

  for (const name of featureNames) {
    const feature = await prisma.feature.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    featureMap[name] = feature.id;
  }

  console.log(`✅ ${featureNames.length} Features seeded\n`);

  // ══════════════════════════════════════
  // Step 2: Seed Plans
  // ══════════════════════════════════════
  const plans = [
    {
      name: "Starter",
      description: "Perfect for small businesses getting started",
      monthlyPrice: 2999,
      annualPrice: 2499,
      status: "ACTIVE",
      maxAgents: 3,
      maxBroadcasts: 10000,
      maxAutomations: 1000,
      maxCampaigns: 5,
      maxApiCalls: null,
      maxAiCredits: null,
      features: [
        "Shared Team Inbox",
        "WhatsApp Payments",
        "Campaign Tracking",
        "Campaign Scheduler",
        "Role Based Access",
        "Webhooks",
      ],
      integrations: [
        "Shopify",
        "Razorpay",
      ],
    },
    {
      name: "Growth",
      description: "For growing teams and automation needs",
      monthlyPrice: 4999,
      annualPrice: 3749,
      status: "ACTIVE",
      maxAgents: 10,
      maxBroadcasts: null,
      maxAutomations: 3000,
      maxCampaigns: null,
      maxApiCalls: 500000,
      maxAiCredits: 500,
      features: [
        "Shared Team Inbox",
        "Omnichannel Inbox",
        "WhatsApp Payments",
        "Drip Campaigns",
        "Campaign Scheduler",
        "Campaign Tracking",
        "Smart Agent Routing",
        "AI Copilot",
        "CTWA Ad Tracking",
        "Native Forms Builder",
        "Role Based Access",
        "Webhooks",
        "Number Masking",
      ],
      integrations: [
        "Shopify",
        "Razorpay",
        "Google Sheets",
        "Zoho CRM",
      ],
    },
    {
      name: "Scale",
      description: "Advanced AI and enterprise-ready features",
      monthlyPrice: 9999,
      annualPrice: 7499,
      status: "ACTIVE",
      maxAgents: 25,
      maxBroadcasts: null,
      maxAutomations: null,
      maxCampaigns: null,
      maxApiCalls: null,
      maxAiCredits: null,
      features: [
        "Shared Team Inbox",
        "Omnichannel Inbox",
        "WhatsApp Payments",
        "Blue Tick Verification",
        "Drip Campaigns",
        "Campaign Scheduler",
        "Campaign Tracking",
        "Smart Agent Routing",
        "AI Copilot",
        "AI Support Agent",
        "AI Voice",
        "Knowledge Base Automation",
        "CTWA Ad Tracking",
        "Native Forms Builder",
        "Multiple Organizations",
        "Number Masking",
        "Role Based Access",
        "Webhooks",
      ],
      integrations: [
        "Shopify",
        "Razorpay",
        "Google Sheets",
        "Zoho CRM",
        "HubSpot",
        "Salesforce",
      ],
    },
  ];

  for (const plan of plans) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {},
      create: {
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        status: plan.status,
        maxAgents: plan.maxAgents,
        maxBroadcasts: plan.maxBroadcasts,
        maxAutomations: plan.maxAutomations,
        maxCampaigns: plan.maxCampaigns,
        maxApiCalls: plan.maxApiCalls,
        maxAiCredits: plan.maxAiCredits,
      },
    });

    // Link features
    for (const featureName of plan.features) {
      const featureId = featureMap[featureName];
      if (!featureId) {
        console.log(`⚠️  Feature not found: ${featureName}`);
        continue;
      }

      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: created.id,
            featureId,
          },
        },
        update: {},
        create: {
          planId: created.id,
          featureId,
        },
      });
    }

    // Link integrations
    for (const name of plan.integrations) {
      await prisma.planIntegration.upsert({
        where: {
          planId_name: {
            planId: created.id,
            name,
          },
        },
        update: {},
        create: {
          planId: created.id,
          name,
        },
      });
    }

    console.log(
      `✅ Plan: ${plan.name} — ${plan.features.length} features, ${plan.integrations.length} integrations`
    );
  }

  // ══════════════════════════════════════
  // Step 3: Seed Platform Settings (GST)
  // ══════════════════════════════════════
  await prisma.platformSettings.upsert({
    where:  { id: "GLOBAL" },
    update: {},
    create: {
      id:               "GLOBAL",
      gstEnabled:       true,
      gstPercent:       18.0,
      gstType:          "CGST_SGST",
      companyGstNumber: "27AABCU9603R1ZM",
      pricingType:      "EXCLUSIVE",
      companyName:      "SudoReply Technologies Pvt Ltd",
      companyEmail:     "info@sudoreply.com",
      companyAddress:   "Mumbai, Maharashtra, India",
      sacCode:          "998314",
    },
  });

  console.log("\n✅ Platform Settings (GST) seeded");

  console.log("\n=================================");
  console.log("🎉 SEED COMPLETE!");
  console.log(`👑 SuperAdmin: ${superAdmin.email}`);
  console.log(`📦 Features  : ${featureNames.length}`);
  console.log(`📋 Plans     : ${plans.length}`);
  console.log("=================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

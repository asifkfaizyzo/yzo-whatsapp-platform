// backend/prisma/seed.plans.js (do not remove this comment)
import { PrismaClient } from "@prisma/client";
import { validateEntitlementsObject } from "../src/lib/entitlements/registry.js";

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════
// 🔧 CONFIGURABLE PLANS & POLICY SEED VARIABLES
// ══════════════════════════════════════════════════════════════════
const PLANS_SEED_CONFIG = {
  toggles: {
    seedPlatformSettings: true,
    seedPlans: true,
  },

  platformSettings: {
    id: "GLOBAL",
    gstEnabled: true,
    gstPercent: 18.0,
    gstType: "CGST_SGST",
    companyGstNumber: "27AABCU9603R1ZM",
    pricingType: "EXCLUSIVE",
    companyName: "SudoReply Technologies Pvt Ltd",
    companyEmail: "info@sudoreply.com",
    companyAddress: "Mumbai, Maharashtra, India",
    sacCode: "998314",
    defaultTrialDays: 14,
    defaultGraceDays: 7,
    trialRetentionDays: 7,
    paidRetentionDays: 90,
  },

  plans: [
    {
      name: "Starter",
      description: "Perfect for small businesses getting started",
      status: "ACTIVE",
      planType: "REGULAR",
      visibility: "PUBLIC",
      sortOrder: 0,
      badgeText: null,
      monthlyPrice: 2999,
      quarterlyPrice: 8097, // ₹2,699/mo equivalent (10% off)
      annualPrice: 29988, // ₹2,499/mo equivalent
      originalPrice: 3499,
      hasTrial: true,
      trialDays: 14,
      trialRequiresCard: false,
      entitlements: validateEntitlementsObject({
        // Team
        maxAgents: 3,
        // Audience
        maxContacts: 10000,
        maxTags: 20,
        maxAttributes: 10,
        maxSegments: 5,
        maxContactLists: 10,
        // Automation
        maxAutomations: 5,
        maxAutomationTriggers: 1000,
        // Messaging & Storage
        maxCampaigns: 10,
        maxBroadcasts: 10000,
        messagingSpeed: 40,
        maxStorageMb: 1024, // 1 GB
        // API & Webhooks
        maxApiCalls: 10000,
        enableApiAccess: true,
        enableWebhooks: true,
        // AI
        enableAiAgent: false,
        maxAiCredits: 0,
        enableAiVoice: false,
        maxAiVoiceCredits: 0,
        // Calling
        enableWhatsappCalling: false,
        // Channels
        allowedChannels: ["WHATSAPP"],
        maxChannels: 1,
        // Integrations
        allowedIntegrations: ["SHOPIFY", "RAZORPAY"],
        maxIntegrations: 2,
        // Features
        enableCampaignScheduler: true,
        enableClickTracking: false,
        enableAutoRetry: false,
        enableCatalog: true,
        enableCustomRoles: false,
        enablePrioritySupport: false,
      }),
    },
    {
      name: "Growth",
      description: "For growing teams and omnichannel automation needs",
      status: "ACTIVE",
      planType: "REGULAR",
      visibility: "PUBLIC",
      sortOrder: 1,
      badgeText: "Most Popular",
      monthlyPrice: 4999,
      quarterlyPrice: 13497, // ₹4,499/mo equivalent (10% off)
      annualPrice: 44988, // ₹3,749/mo equivalent
      originalPrice: 5999,
      hasTrial: true,
      trialDays: 14,
      trialRequiresCard: false,
      entitlements: validateEntitlementsObject({
        // Team
        maxAgents: 10,
        // Audience
        maxContacts: 50000,
        maxTags: 100,
        maxAttributes: 50,
        maxSegments: 25,
        maxContactLists: 50,
        // Automation
        maxAutomations: 25,
        maxAutomationTriggers: 5000,
        // Messaging & Storage
        maxCampaigns: -1, // Unlimited
        maxBroadcasts: -1, // Unlimited
        messagingSpeed: 100,
        maxStorageMb: 5120, // 5 GB
        // API & Webhooks
        maxApiCalls: 500000,
        enableApiAccess: true,
        enableWebhooks: true,
        // AI
        enableAiAgent: true,
        maxAiCredits: 2000,
        enableAiVoice: false,
        maxAiVoiceCredits: 0,
        // Calling
        enableWhatsappCalling: true,
        // Channels
        allowedChannels: ["WHATSAPP", "INSTAGRAM", "MESSENGER"],
        maxChannels: 2,
        // Integrations
        allowedIntegrations: [
          "SHOPIFY",
          "WOOCOMMERCE",
          "ZOHO",
          "GOOGLE_SHEETS",
          "RAZORPAY",
        ],
        maxIntegrations: 5,
        // Features
        enableCampaignScheduler: true,
        enableClickTracking: true,
        enableAutoRetry: true,
        enableCatalog: true,
        enableCustomRoles: true,
        enablePrioritySupport: false,
      }),
    },
    {
      name: "Scale",
      description: "Advanced AI, voice calling, and high-scale capabilities",
      status: "ACTIVE",
      planType: "REGULAR",
      visibility: "PUBLIC",
      sortOrder: 2,
      badgeText: "Best Value",
      monthlyPrice: 9999,
      quarterlyPrice: 26997, // ₹8,999/mo equivalent (10% off)
      annualPrice: 89988, // ₹7,499/mo equivalent
      originalPrice: 11999,
      hasTrial: true,
      trialDays: 14,
      trialRequiresCard: false,
      entitlements: validateEntitlementsObject({
        // Team
        maxAgents: 25,
        // Audience
        maxContacts: -1, // Unlimited
        maxTags: 250,
        maxAttributes: -1, // Unlimited
        maxSegments: 100,
        maxContactLists: 100,
        // Automation
        maxAutomations: -1, // Unlimited
        maxAutomationTriggers: 25000,
        // Messaging & Storage
        maxCampaigns: -1, // Unlimited
        maxBroadcasts: -1, // Unlimited
        messagingSpeed: 500,
        maxStorageMb: 20480, // 20 GB
        // API & Webhooks
        maxApiCalls: -1, // Unlimited
        enableApiAccess: true,
        enableWebhooks: true,
        // AI
        enableAiAgent: true,
        maxAiCredits: 10000,
        enableAiVoice: true,
        maxAiVoiceCredits: 1000,
        // Calling
        enableWhatsappCalling: true,
        // Channels
        allowedChannels: ["WHATSAPP", "INSTAGRAM", "MESSENGER"],
        maxChannels: 3,
        // Integrations
        allowedIntegrations: [
          "SHOPIFY",
          "WOOCOMMERCE",
          "ZOHO",
          "GOOGLE_SHEETS",
          "RAZORPAY",
        ],
        maxIntegrations: -1, // Unlimited
        // Features
        enableCampaignScheduler: true,
        enableClickTracking: true,
        enableAutoRetry: true,
        enableCatalog: true,
        enableCustomRoles: true,
        enablePrioritySupport: true,
      }),
    },
  ],
};
// ══════════════════════════════════════════════════════════════════

async function main() {
  console.log("🌱 Starting Plans V2 & Billing Policy seed...\n");

  // ══════════════════════════════════════
  // Step 1: Seed Platform Settings (GST + V2 Subscription Policy)
  // ══════════════════════════════════════
  if (PLANS_SEED_CONFIG.toggles.seedPlatformSettings) {
    const s = PLANS_SEED_CONFIG.platformSettings;
    await prisma.platformSettings.upsert({
      where: { id: s.id },
      update: {
        defaultTrialDays: s.defaultTrialDays,
        defaultGraceDays: s.defaultGraceDays,
        trialRetentionDays: s.trialRetentionDays,
        paidRetentionDays: s.paidRetentionDays,
      },
      create: s,
    });
    console.log("✅ Platform Settings (GST + Subscription Policy) seeded\n");
  }

  // ══════════════════════════════════════
  // Step 2: Seed V2 Subscription Plans (Catalog Only — No Tenant Assignment)
  // ══════════════════════════════════════
  if (PLANS_SEED_CONFIG.toggles.seedPlans) {
    for (const plan of PLANS_SEED_CONFIG.plans) {
      await prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: {
          description: plan.description,
          status: plan.status,
          planType: plan.planType,
          visibility: plan.visibility,
          sortOrder: plan.sortOrder,
          badgeText: plan.badgeText,
          monthlyPrice: plan.monthlyPrice,
          quarterlyPrice: plan.quarterlyPrice,
          annualPrice: plan.annualPrice,
          originalPrice: plan.originalPrice,
          hasTrial: plan.hasTrial,
          trialDays: plan.trialDays,
          trialRequiresCard: plan.trialRequiresCard,
          entitlements: plan.entitlements,
        },
        create: plan,
      });

      console.log(
        `✅ Plan seeded: ${plan.name} (₹${plan.monthlyPrice}/mo, ${Object.keys(plan.entitlements).length} entitlements)`,
      );
    }
  }

  console.log("\n=================================");
  console.log("🎉 PLANS V2 SEED COMPLETE!");
  console.log(
    `📋 Plans Seeded: ${PLANS_SEED_CONFIG.plans.length} (${PLANS_SEED_CONFIG.plans.map((p) => p.name).join(", ")})`,
  );
  console.log(`🔗 Assignments : 0 (ready for trial/checkout/admin testing)`);
  console.log("=================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Plans seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
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
      integrations: ["Shopify", "Razorpay"],
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
      integrations: ["Shopify", "Razorpay", "Google Sheets", "Zoho CRM"],
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
      integrations: ["Shopify", "Razorpay", "Google Sheets", "Zoho CRM", "HubSpot", "Salesforce"],
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

    for (const featureName of plan.features) {
      const featureId = featureMap[featureName];
      if (!featureId) {
        console.log(`⚠️  Feature not found: ${featureName}`);
        continue;
      }
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: created.id, featureId } },
        update: {},
        create: { planId: created.id, featureId },
      });
    }

    for (const name of plan.integrations) {
      await prisma.planIntegration.upsert({
        where: { planId_name: { planId: created.id, name } },
        update: {},
        create: { planId: created.id, name },
      });
    }

    console.log(`✅ Plan: ${plan.name} — ${plan.features.length} features, ${plan.integrations.length} integrations`);
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

  // ══════════════════════════════════════
  // Resolve tenant (used by Steps 3.5, 4, 5)
  // ══════════════════════════════════════
  const tenant = await prisma.tenant.findFirst();

  if (!tenant) {
    console.log("\n⚠️  No tenant found in DB — skipping Templates, Quick Replies & Campaigns.");
    console.log("   Create a tenant first, then re-run the seed.\n");
  } else {
    console.log(`\n📌 Using tenant: ${tenant.tenantName || tenant.id}`);

    // ══════════════════════════════════════
    // Step 3.5: Seed Templates
    // ══════════════════════════════════════
    const templates = [
      {
        name: "diwali_sale_offer",
        language: "en_US",
        category: "MARKETING",
        status: "APPROVED",
        headerType: "TEXT",
        headerText: "🪔 Diwali Special!",
        footerText: "Offer valid till Nov 15",
        bodyParams: 2,
        headerParams: 0,
        components: [
          { type: "HEADER", format: "TEXT", text: "🪔 Diwali Special!" },
          {
            type: "BODY",
            text: "Hi {{1}}!\n\nCelebrate Diwali with {{2}} on all plans! Use code DIWALI30 at checkout.\n\n🔗 https://sudoreply.com/diwali",
          },
          { type: "FOOTER", text: "Offer valid till Nov 15" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "URL", text: "Shop Now", url: "https://sudoreply.com/diwali" },
            ],
          },
        ],
        buttons: [
          { type: "URL", text: "Shop Now", url: "https://sudoreply.com/diwali" },
        ],
      },
      {
        name: "order_confirmation",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        headerType: "TEXT",
        headerText: "✅ Order Confirmed",
        footerText: "Thank you for shopping with us!",
        bodyParams: 3,
        headerParams: 0,
        components: [
          { type: "HEADER", format: "TEXT", text: "✅ Order Confirmed" },
          {
            type: "BODY",
            text: "Hi {{1}},\n\nYour order #{{2}} has been confirmed!\n\n📦 Estimated delivery: {{3}}\n\nTrack your order anytime at https://sudoreply.com/track",
          },
          { type: "FOOTER", text: "Thank you for shopping with us!" },
        ],
        buttons: null,
      },
      {
        name: "payment_reminder",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        headerType: "TEXT",
        headerText: "💰 Payment Due",
        footerText: "Ignore if already paid",
        bodyParams: 2,
        headerParams: 0,
        components: [
          { type: "HEADER", format: "TEXT", text: "💰 Payment Due" },
          {
            type: "BODY",
            text: "Hi {{1}},\n\nThis is a friendly reminder that your payment of {{2}} is due soon.\n\nPlease complete the payment to avoid service interruption.\n\n🔗 https://sudoreply.com/pay",
          },
          { type: "FOOTER", text: "Ignore if already paid" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "URL", text: "Pay Now", url: "https://sudoreply.com/pay" },
            ],
          },
        ],
        buttons: [
          { type: "URL", text: "Pay Now", url: "https://sudoreply.com/pay" },
        ],
      },
    ];

    let tplCount = 0;
    for (const tpl of templates) {
      const existing = await prisma.template.findFirst({
        where: {
          tenantId: tenant.id,
          name: tpl.name,
          language: tpl.language,
        },
      });

      if (existing) {
        console.log(`  ⏭️  Template "${tpl.name}" already exists — skipping`);
        continue;
      }

      await prisma.template.create({
        data: {
          tenantId: tenant.id,
          name: tpl.name,
          language: tpl.language,
          category: tpl.category,
          status: tpl.status,
          components: tpl.components,
          headerType: tpl.headerType,
          headerText: tpl.headerText,
          footerText: tpl.footerText,
          bodyParams: tpl.bodyParams,
          headerParams: tpl.headerParams,
          buttons: tpl.buttons,
          metaTemplateId: `mock_meta_${Date.now()}_${tplCount}`,
          qualityScore: "GREEN",
        },
      });
      tplCount++;
    }
    console.log(`✅ ${tplCount} Templates seeded (${templates.length - tplCount} already existed)`);

    // ══════════════════════════════════════
    // Step 4: Seed Quick Replies
    // ══════════════════════════════════════

    // Find first agent user for PERSONAL scope replies
    const agent = await prisma.user.findFirst({
      where: { tenantId: tenant.id },
    });

    const quickReplies = [
      // ── Sales ──
      {
        shortcut: "pricing",
        title: "Standard Pricing",
        content: "Hi {{name}}! 👋\n\nHere are our pricing plans:\n\n🥉 Starter — ₹2,999/mo\n🥈 Growth — ₹4,999/mo\n🥇 Scale — ₹9,999/mo\n\nWould you like a detailed comparison?",
        category: "Sales",
        scope: "GLOBAL",
      },
      {
        shortcut: "demo",
        title: "Book a Demo",
        content: "Great choice, {{name}}! 🎉\n\nYou can book a free 15-min demo here:\n📅 https://calendly.com/sudoreply/demo\n\nPick a slot that works for you!",
        category: "Sales",
        scope: "GLOBAL",
      },
      {
        shortcut: "trial",
        title: "Free Trial Info",
        content: "Yes, we offer a 14-day free trial on all plans! No credit card required.\n\nJust sign up at https://sudoreply.com/trial and you're good to go. 🚀",
        category: "Sales",
        scope: "GLOBAL",
      },
      // ── Support ──
      {
        shortcut: "hours",
        title: "Business Hours",
        content: "Our support team is available:\n\n🕘 Mon–Fri: 9 AM – 7 PM IST\n🕐 Sat: 10 AM – 4 PM IST\n🔴 Sun: Closed\n\nFor urgent issues, email support@sudoreply.com",
        category: "Support",
        scope: "GLOBAL",
      },
      {
        shortcut: "reset",
        title: "Password Reset",
        content: "To reset your password:\n\n1️⃣ Go to the login page\n2️⃣ Click 'Forgot Password'\n3️⃣ Enter your email\n4️⃣ Check your inbox for the reset link\n\nLink expires in 30 minutes. ⏰",
        category: "Support",
        scope: "GLOBAL",
      },
      {
        shortcut: "escalate",
        title: "Escalate to Manager",
        content: "I understand this needs more attention. I'm escalating your case to our senior team. You'll hear back within 2 hours. 🙏\n\nReference: {{ticketId}}",
        category: "Support",
        scope: "GLOBAL",
      },
      // ── Billing ──
      {
        shortcut: "invoice",
        title: "Invoice Request",
        content: "Hi {{name}},\n\nYour latest invoice has been sent to {{email}}. 📄\n\nYou can also download it from Dashboard → Billing → Invoices.\n\nLet me know if you need anything else!",
        category: "Billing",
        scope: "GLOBAL",
      },
      {
        shortcut: "refund",
        title: "Refund Policy",
        content: "We offer a full refund within 7 days of purchase, no questions asked.\n\nTo request a refund:\n📧 Email billing@sudoreply.com\n📞 Or call +91-XXXX-XXXXXX\n\nRefunds are processed within 5–7 business days.",
        category: "Billing",
        scope: "GLOBAL",
      },
      // ── General ──
      {
        shortcut: "welcome",
        title: "Welcome Message",
        content: "Welcome to Sudo Reply, {{name}}! 🎊\n\nWe're excited to have you on board. Here's what you can do first:\n\n✅ Connect your WhatsApp number\n✅ Import your contacts\n✅ Set up your first campaign\n\nNeed help? Just type /help anytime!",
        category: "General",
        scope: "GLOBAL",
      },
      {
        shortcut: "thanks",
        title: "Thank You",
        content: "Thank you for reaching out, {{name}}! 😊\n\nIf you have any more questions, don't hesitate to ask. Have a great day! 🌟",
        category: "General",
        scope: "GLOBAL",
      },
            // ── Variable Testing ──
      {
        shortcut: "var-phone",
        title: "Test: Phone Variable",
        content: "Hi {{name}}! We have your number saved as {{phone}}. Is this correct?",
        category: "Testing",
        scope: "GLOBAL",
      },
      {
        shortcut: "var-company",
        title: "Test: Company Variable",
        content: "Hello {{name}} from {{company}}! We'd love to set up a partnership. Can we schedule a call?",
        category: "Testing",
        scope: "GLOBAL",
      },
      {
        shortcut: "var-agent",
        title: "Test: Agent Name Variable",
        content: "Hi {{name}}! My name is {{agent_name}} and I'll be handling your case today. How can I help?",
        category: "Testing",
        scope: "GLOBAL",
      },
      {
        shortcut: "var-datetime",
        title: "Test: Date & Time Variables",
        content: "Hi {{name}}!\n\nThis message was generated on {{current_date}} at {{current_time}}.\n\nYour ticket has been logged.",
        category: "Testing",
        scope: "GLOBAL",
      },
      {
        shortcut: "var-all",
        title: "Test: All Variables",
        content: "Hi {{name}}!\n\n📱 Phone: {{phone}}\n🏢 Company: {{company}}\n👤 Agent: {{agent_name}}\n📅 Date: {{current_date}}\n🕐 Time: {{current_time}}\n\nAll variables replaced!",
        category: "Testing",
        scope: "GLOBAL",
      },
      {
        shortcut: "var-unknown",
        title: "Test: Unknown Variable (stays as-is)",
        content: "Hi {{name}}! Your order {{order_id}} is being shipped to {{address}}. Track it at {{tracking_url}}.",
        category: "Testing",
        scope: "GLOBAL",
      },
    ];

    // Add a PERSONAL scope reply if an agent exists
    if (agent) {
      quickReplies.push({
        shortcut: "my-intro",
        title: "Agent Introduction",
        content: `Hi {{name}}! I'm ${agent.name || 'your agent'}, your dedicated support rep at Sudo Reply. Feel free to ask me anything! 👋`,
        category: "General",
        scope: "PERSONAL",
        userId: agent.id,
      });
    }

    let qrCount = 0;
    for (const qr of quickReplies) {
      const existing = await prisma.quickReply.findFirst({
        where: {
          tenantId: tenant.id,
          shortcut: qr.shortcut,
          scope: qr.scope,
          ...(qr.scope === "PERSONAL" ? { userId: qr.userId } : {}),
        },
      });

      if (existing) {
        console.log(`  ⏭️  Quick reply "/${qr.shortcut}" already exists — skipping`);
        continue;
      }

      await prisma.quickReply.create({
        data: {
          tenantId: tenant.id,
          shortcut: qr.shortcut,
          title: qr.title,
          content: qr.content,
          category: qr.category,
          scope: qr.scope,
          userId: qr.userId || null,
          createdByType: qr.scope === "PERSONAL" ? "USER" : "TENANT",
          createdByName: qr.scope === "PERSONAL" ? agent?.name : "Seed Script",
          isActive: true,
        },
      });
      qrCount++;
    }
    console.log(`✅ ${qrCount} Quick Replies seeded (${quickReplies.length - qrCount} already existed)`);

    // ══════════════════════════════════════
    // Step 5: Seed Campaigns (Broadcasts)
    // ══════════════════════════════════════
    const template = await prisma.template.findFirst({
      where: { tenantId: tenant.id },
    });

    if (!template) {
      console.log("\n⚠️  No template found for this tenant — skipping Campaigns.");
      console.log("   Create a WhatsApp template first (via web dashboard), then re-run the seed.\n");
    } else {
      console.log(`📌 Using template: ${template.name || template.id}`);

      const campaigns = [
        {
          name: "Diwali Sale 2024 🪔",
          targetType: "ALL",
          status: "DRAFT",
          defaultParams: { offer: "30% off", code: "DIWALI30", validTill: "Nov 15" },
        },
        {
          name: "New Feature Announcement 🚀",
          targetType: "ALL",
          status: "DRAFT",
          defaultParams: { feature: "AI Copilot", link: "https://sudoreply.com/ai" },
        },
        {
          name: "Payment Reminder 💰",
          targetType: "ALL",
          status: "DRAFT",
          defaultParams: { dueDate: "Nov 30", amount: "₹4,999" },
        },
      ];

      let campCount = 0;
      for (const camp of campaigns) {
        const existing = await prisma.broadcast.findFirst({
          where: { tenantId: tenant.id, name: camp.name },
        });

        if (existing) {
          console.log(`  ⏭️  Campaign "${camp.name}" already exists — skipping`);
          continue;
        }

        await prisma.broadcast.create({
          data: {
            tenantId: tenant.id,
            templateId: template.id,
            name: camp.name,
            targetType: camp.targetType,
            status: camp.status,
            defaultParams: camp.defaultParams,
            batchSize: 50,
            batchDelayMs: 1000,
          },
        });
        campCount++;
      }
      console.log(`✅ ${campCount} Campaigns seeded (${campaigns.length - campCount} already existed)`);
    }
  }

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
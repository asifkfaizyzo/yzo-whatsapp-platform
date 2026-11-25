// backend/prisma/seed-test-data.js (do not remove this comment)
// ═══════════════════════════════════════════════════════════════
// 🧪 TEST DATA SEED — kirankiran71060@gmail.com
// Seeds: Tenant, Auth, WhatsApp config, Subscription, Agents,
//        Tags, Contacts, Conversations, Messages,
//        Templates, Quick Replies & Broadcasts
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const TENANT_EMAIL = "kirankiran71060@gmail.com";
const TENANT_PASSWORD = "Kiran@123";
const AGENT_PASSWORD = "Agent@123";

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function main() {
  console.log("🌱 Starting TEST DATA seed...\n");

  // ══════════════════════════════════════
  // Step 1: Tenant
  // ══════════════════════════════════════
  const hashedPw = await bcrypt.hash(TENANT_PASSWORD, 10);

  let tenant = await prisma.tenant.findUnique({
    where: { email: TENANT_EMAIL },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        tenantName: "Kiran Demo Store",
        email: TENANT_EMAIL,
        password: hashedPw,
        phone: "9876543210",
        firstName: "Kiran",
        lastName: "Kumar",
        industry: "E-commerce",
        companySize: "1-10",
        country: "India",
        status: "ACTIVE",
        onboardingStep: 5,
        onboardingCompleted: true,
      },
    });
    console.log(`✅ Tenant created: ${tenant.email} (${tenant.id})`);
  } else {
    console.log(`⏭️  Tenant already exists: ${tenant.email} (${tenant.id})`);
  }

  // ══════════════════════════════════════
  // Step 2: Tenant Auth + WhatsApp config
  // ══════════════════════════════════════
  await prisma.tenantAuth.upsert({
    where: { tenantId: tenant.id },
    update: { isEmailVerified: true },
    create: {
      tenantId: tenant.id,
      authProvider: "LOCAL",
      isEmailVerified: true,
    },
  });

  await prisma.tenantWhatsApp.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      whatsappPhoneId: "mock_phone_id_123456",
      whatsappWabaId: "mock_waba_id_123456",
      whatsappAccessToken: "mock_access_token_replace_me",
    },
  });
  console.log("✅ TenantAuth + TenantWhatsApp seeded");

  // ══════════════════════════════════════
  // Step 3: Subscription (Growth plan)
  // ══════════════════════════════════════
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { name: "Growth" },
  });

  await prisma.tenantSubscription.upsert({
    where: { tenantId: tenant.id },
    update: plan ? { planId: plan.id, planStatus: "active" } : {},
    create: {
      tenantId: tenant.id,
      planId: plan?.id || null,
      planActivatedAt: new Date(),
      planStatus: "active",
      billingType: "monthly",
      subscriptionStatus: "active",
      currentPlan: plan?.name || null,
      planPeriodStart: new Date(),
      planPeriodEnd: daysAgo(-30),
      enableCod: true,
      enableOnlinePayment: false,
    },
  });
  console.log(`✅ Subscription seeded (plan: ${plan?.name || "none found"})`);

  // ══════════════════════════════════════
  // Step 4: Agents (Users)
  // ══════════════════════════════════════
  const agentPw = await bcrypt.hash(AGENT_PASSWORD, 10);
  const agentData = [
    { name: "Priya Sharma", email: "priya@demo.com" },
    { name: "Rahul Verma", email: "rahul@demo.com" },
    { name: "Sneha Patil", email: "sneha@demo.com" },
  ];

  const agents = [];
  for (const a of agentData) {
    let user = await prisma.user.findFirst({
      where: { email: a.email, tenantId: tenant.id },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: a.name,
          email: a.email,
          password: agentPw,
          isActive: true,
          availabilityStatus: "AVAILABLE",
        },
      });
    }
    agents.push(user);
  }
  console.log(`✅ ${agents.length} agent users seeded`);

  // ══════════════════════════════════════
  // Step 5: Tags
  // ══════════════════════════════════════
  const tagData = [
    { name: "VIP", priority: 1, description: "High-value customers" },
    { name: "New Lead", priority: 2, description: "Fresh inbound leads" },
    { name: "Payment Pending", priority: 1, description: "Awaiting payment" },
    { name: "Support", priority: 3, description: "Support requests" },
    { name: "Repeat Customer", priority: 2, description: "Ordered before" },
  ];

  const tagMap = {};
  for (const t of tagData) {
    let tag = await prisma.tag.findFirst({
      where: { name: t.name, tenantId: tenant.id },
    });
    if (!tag) {
      tag = await prisma.tag.create({
        data: { ...t, tenantId: tenant.id },
      });
    }
    tagMap[t.name] = tag.id;
  }
  console.log(`✅ ${tagData.length} tags seeded`);

  // ══════════════════════════════════════
  // Step 6: Contacts (+ Tag Mappings)
  // ══════════════════════════════════════
  const contactData = [
    { name: "Aarav Patel",    phone: "9812345601", email: "aarav@gmail.com",   company: "Patil Traders",     tags: ["New Lead"] },
    { name: "Sneha Reddy",    phone: "9812345602", email: "sneha@gmail.com",   company: "Reddy Enterprises",  tags: ["VIP", "Repeat Customer"] },
    { name: "Vikram Singh",   phone: "9812345603", email: "vikram@gmail.com",  company: null,                tags: ["Payment Pending"] },
    { name: "Ananya Iyer",    phone: "9812345604", email: "ananya@gmail.com",  company: "Iyer & Co",         tags: ["Support"] },
    { name: "Rohit Mehta",    phone: "9812345605", email: "rohit@gmail.com",   company: null,                tags: ["New Lead"] },
    { name: "Divya Nair",     phone: "9812345606", email: "divya@gmail.com",   company: "Nair Textiles",     tags: ["VIP"] },
    { name: "Arjun Desai",    phone: "9812345607", email: null,                company: null,                tags: [] },
    { name: "Meera Joshi",    phone: "9812345608", email: "meera@gmail.com",   company: "Joshi Crafts",      tags: ["Repeat Customer"] },
    { name: "Karan Malhotra", phone: "9812345609", email: "karan@gmail.com",   company: null,                tags: ["Support"] },
    { name: "Ishita Bose",    phone: "9812345610", email: "ishita@gmail.com",  company: "Bose Retail",       tags: ["New Lead", "VIP"] },
  ];

  const contactMap = {};
  for (const c of contactData) {
    let contact = await prisma.contact.findFirst({
      where: { phone: c.phone, tenantId: tenant.id },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          company: c.company,
          countryCode: "+91",
          whatsappId: `91${c.phone}`,
          channel: "WHATSAPP",
          assignedTo: agents[1]?.id || null,
          assignedAt: new Date(),
        },
      });
    }
    contactMap[c.name] = contact;

    for (const tagName of c.tags) {
      if (!tagMap[tagName]) continue;
      await prisma.contactTagMapping.upsert({
        where: {
          contactId_tagId: { contactId: contact.id, tagId: tagMap[tagName] },
        },
        update: {},
        create: { contactId: contact.id, tagId: tagMap[tagName] },
      });
    }
  }
  console.log(`✅ ${contactData.length} contacts seeded`);

  // ══════════════════════════════════════
  // Step 7: Conversations + Messages
  // ══════════════════════════════════════
  const conversationData = [
    {
      contactName: "Aarav Patel",
      status: "OPEN",
      unreadCount: 1,
      assignedTo: agents[1]?.id,
      messages: [
        { direction: "INBOUND",  senderType: "CONTACT", text: "Hi, I saw your ad for the Diwali sale 🪔", at: hoursAgo(3) },
        { direction: "INBOUND",  senderType: "CONTACT", text: "Is the 30% discount still available?", at: hoursAgo(3) },
        { direction: "OUTBOUND", senderType: "USER",    text: "Hi Aarav! Yes — use code DIWALI30 at checkout 🎉", at: hoursAgo(2.5), status: "read", senderId: agents[1]?.id },
        { direction: "INBOUND",  senderType: "CONTACT", text: "Great! Does it work on the annual plan too?", at: hoursAgo(0.5) },
      ],
    },
    {
      contactName: "Sneha Reddy",
      status: "OPEN",
      unreadCount: 0,
      assignedTo: agents[0]?.id,
      messages: [
        { direction: "INBOUND",  senderType: "CONTACT", text: "My order #1024 hasn't arrived yet 😟", at: hoursAgo(6) },
        { direction: "OUTBOUND", senderType: "USER",    text: "Sorry to hear that Sneha! Checking with the courier now…", at: hoursAgo(5.8), status: "read", senderId: agents[0]?.id },
        { direction: "OUTBOUND", senderType: "USER",    text: "Good news — it's out for delivery and will arrive today by 7 PM 🚚", at: hoursAgo(5.5), status: "read", senderId: agents[0]?.id },
        { direction: "INBOUND",  senderType: "CONTACT", text: "Perfect, thank you so much! 🙏", at: hoursAgo(5) },
      ],
    },
    {
      contactName: "Vikram Singh",
      status: "PENDING",
      unreadCount: 1,
      assignedTo: agents[2]?.id,
      messages: [
        { direction: "INBOUND",  senderType: "CONTACT", text: "I paid via UPI but my order still shows pending", at: daysAgo(1) },
        { direction: "OUTBOUND", senderType: "USER",    text: "Hi Vikram, sorry about that. Can you share the UPI reference number (UTR)?", at: daysAgo(0.9), status: "delivered", senderId: agents[2]?.id },
        { direction: "INBOUND",  senderType: "CONTACT", text: "UTR: 416283940512", at: hoursAgo(1) },
      ],
    },
    {
      contactName: "Ananya Iyer",
      status: "RESOLVED",
      unreadCount: 0,
      assignedTo: null,
      messages: [
        { direction: "INBOUND",  senderType: "CONTACT", text: "How do I reset my password?", at: daysAgo(2) },
        { direction: "OUTBOUND", senderType: "USER",    text: "Go to Login → Forgot Password → check your email. Link expires in 30 mins ⏰", at: daysAgo(1.95), status: "read", senderId: agents[0]?.id },
        { direction: "INBOUND",  senderType: "CONTACT", text: "Done, thanks!", at: daysAgo(1.9) },
      ],
    },
    {
      contactName: "Rohit Mehta",
      status: "OPEN",
      unreadCount: 2,
      assignedTo: agents[1]?.id,
      messages: [
        { direction: "INBOUND", senderType: "CONTACT", text: "Do you ship to Hyderabad?", at: hoursAgo(1.2) },
        { direction: "INBOUND", senderType: "CONTACT", text: "And what's the delivery time?", at: hoursAgo(1.1) },
      ],
    },
    {
      contactName: "Meera Joshi",
      status: "OPEN",
      unreadCount: 0,
      assignedTo: null,
      messages: [
        { direction: "INBOUND",  senderType: "CONTACT", text: "Loved my last order! Do you have the blue saree in stock again?", at: daysAgo(0.4) },
        { direction: "OUTBOUND", senderType: "USER",    text: "Hi Meera! Yes, it's back in stock 🎉 Want me to share the payment link?", at: hoursAgo(8), status: "read", senderId: agents[1]?.id },
        { direction: "INBOUND",  senderType: "CONTACT", text: "Yes please!", at: hoursAgo(7.8) },
      ],
    },
  ];

  let convCount = 0;
  let msgCount = 0;

  for (const item of conversationData) {
    const contact = contactMap[item.contactName];
    if (!contact) continue;

    let conv = await prisma.conversation.findUnique({
      where: { contactId: contact.id },
    });

    const lastMsg = item.messages[item.messages.length - 1];
    const firstOutbound = item.messages.find((m) => m.direction === "OUTBOUND");

    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          status: item.status,
          channel: "WHATSAPP",
          assignedTo: item.assignedTo || null,
          isArchived: false,
          unreadCount: item.unreadCount,
          lastMessageAt: lastMsg.at,
          botPaused: true,
          incomingAt: item.messages[0].at,
          firstResponseAt: firstOutbound?.at || null,
        },
      });
      convCount++;
    }

    for (const m of item.messages) {
      const wamidStr = `wamid.HBgM${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
      
      const existingMsg = await prisma.message.findFirst({
        where: { conversationId: conv.id, text: m.text },
      });

      if (!existingMsg) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            senderId: m.direction === "INBOUND" ? contact.id : m.senderId || null,
            senderType: m.senderType,
            direction: m.direction,
            type: "TEXT",
            text: m.text,
            isRead: m.direction === "INBOUND" ? item.unreadCount === 0 : true,
            status: m.direction === "OUTBOUND" ? m.status || "sent" : "delivered",
            wamid: wamidStr,
            createdAt: m.at,
          },
        });
        msgCount++;
      }
    }
  }
  console.log(`✅ ${convCount} conversations + ${msgCount} messages seeded`);

  // ══════════════════════════════════════
  // Step 8: Templates
  // ══════════════════════════════════════
  const templateData = [
    {
      name: "diwali_sale_offer",
      language: "en_US",
      category: "MARKETING",
      status: "APPROVED",
      headerType: "TEXT",
      headerText: "🪔 Festive Special Offer!",
      footerText: "Reply STOP to unsubscribe",
      bodyParams: 2,
      headerParams: 0,
      components: [
        { type: "HEADER", format: "TEXT", text: "🪔 Festive Special Offer!" },
        {
          type: "BODY",
          text: "Hi {{1}}!\n\nEnjoy {{2}} off on all items! Use code FESTIVE30 at checkout.\n\nShop now: https://kiranstore.com",
        },
        { type: "FOOTER", text: "Reply STOP to unsubscribe" },
        {
          type: "BUTTONS",
          buttons: [
            { type: "URL", text: "Shop Now", url: "https://kiranstore.com" },
          ],
        },
      ],
      buttons: [
        { type: "URL", text: "Shop Now", url: "https://kiranstore.com" },
      ],
    },
    {
      name: "order_confirmation",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      headerType: "TEXT",
      headerText: "📦 Order Confirmed",
      footerText: "Thank you for shopping with Kiran Store!",
      bodyParams: 3,
      headerParams: 0,
      components: [
        { type: "HEADER", format: "TEXT", text: "📦 Order Confirmed" },
        {
          type: "BODY",
          text: "Hi {{1}},\n\nYour order #{{2}} is confirmed!\nEstimated delivery: {{3}}.\n\nTrack your order here: https://kiranstore.com/track",
        },
        { type: "FOOTER", text: "Thank you for shopping with Kiran Store!" },
      ],
      buttons: null,
    },
    {
      name: "payment_reminder",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      headerType: "TEXT",
      headerText: "💰 Payment Pending",
      footerText: "Ignore if already paid",
      bodyParams: 2,
      headerParams: 0,
      components: [
        { type: "HEADER", format: "TEXT", text: "💰 Payment Pending" },
        {
          type: "BODY",
          text: "Hi {{1}},\n\nYour payment of {{2}} is due. Please complete it using the link below to process your order.",
        },
        { type: "FOOTER", text: "Ignore if already paid" },
        {
          type: "BUTTONS",
          buttons: [
            { type: "URL", text: "Pay Now", url: "https://kiranstore.com/pay" },
          ],
        },
      ],
      buttons: [
        { type: "URL", text: "Pay Now", url: "https://kiranstore.com/pay" },
      ],
    },
  ];

  const createdTemplates = [];
  for (const tpl of templateData) {
    let template = await prisma.template.findFirst({
      where: { tenantId: tenant.id, name: tpl.name, language: tpl.language },
    });

    if (!template) {
      template = await prisma.template.create({
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
          metaTemplateId: `mock_meta_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          qualityScore: "GREEN",
        },
      });
    }
    createdTemplates.push(template);
  }
  console.log(`✅ ${createdTemplates.length} templates seeded`);

  // ══════════════════════════════════════
  // Step 9: Quick Replies
  // ══════════════════════════════════════
  const quickRepliesData = [
    {
      shortcut: "pricing",
      title: "Pricing Plans",
      content: "Hi {{name}}! 👋 Here are our pricing options:\n\n🥉 Starter — ₹2,999/mo\n🥈 Growth — ₹4,999/mo\n🥇 Scale — ₹9,999/mo\n\nLet me know if you need help choosing!",
      category: "Sales",
      scope: "GLOBAL",
    },
    {
      shortcut: "demo",
      title: "Book Demo",
      content: "Great choice, {{name}}! 🎉 Book a 15-min live demo here:\n📅 https://calendly.com/kiran-store/demo",
      category: "Sales",
      scope: "GLOBAL",
    },
    {
      shortcut: "hours",
      title: "Store Timings",
      content: "Hi {{name}}! Our customer support hours are:\n\n🕘 Mon–Fri: 9 AM – 7 PM IST\n🕐 Sat: 10 AM – 4 PM IST\n🔴 Sun: Closed",
      category: "Support",
      scope: "GLOBAL",
    },
    {
      shortcut: "thanks",
      title: "Thank You Response",
      content: "Thank you for reaching out, {{name}}! 😊 Have a wonderful day!",
      category: "General",
      scope: "GLOBAL",
    },
    {
      shortcut: "my-intro",
      title: "Agent Intro",
      content: `Hi {{name}}! I'm ${agents[0]?.name || "your agent"}, your account rep. How can I help you today?`,
      category: "General",
      scope: "PERSONAL",
      userId: agents[0]?.id || null,
    },
  ];

  let qrCount = 0;
  for (const qr of quickRepliesData) {
    const existing = await prisma.quickReply.findFirst({
      where: {
        tenantId: tenant.id,
        shortcut: qr.shortcut,
        scope: qr.scope,
      },
    });

    if (!existing) {
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
          createdByName: qr.scope === "PERSONAL" ? agents[0]?.name : "Kiran Store Admin",
          isActive: true,
        },
      });
      qrCount++;
    }
  }
  console.log(`✅ ${qrCount} quick replies seeded`);

  // ══════════════════════════════════════
  // Step 10: Broadcast Campaigns
  // ══════════════════════════════════════
  if (createdTemplates.length > 0) {
    const broadcastData = [
      {
        name: "Diwali Fest Blast 🪔",
        templateId: createdTemplates[0].id,
        targetType: "ALL",
        status: "COMPLETED",
        totalRecipients: 10,
        sent: 10,
        delivered: 9,
        read: 7,
        failed: 1,
        startedAt: daysAgo(2),
        completedAt: daysAgo(2),
        defaultParams: { 1: "Valued Customer", 2: "30%" },
      },
      {
        name: "Weekend Special Promo 🚀",
        templateId: createdTemplates[0].id,
        targetType: "ALL",
        status: "DRAFT",
        totalRecipients: 0,
        defaultParams: { 1: "Valued Customer", 2: "20%" },
      },
    ];

    let bCount = 0;
    for (const b of broadcastData) {
      const existing = await prisma.broadcast.findFirst({
        where: { tenantId: tenant.id, name: b.name },
      });

      if (!existing) {
        await prisma.broadcast.create({
          data: {
            tenantId: tenant.id,
            name: b.name,
            templateId: b.templateId,
            targetType: b.targetType,
            status: b.status,
            totalRecipients: b.totalRecipients || 0,
            sent: b.sent || 0,
            delivered: b.delivered || 0,
            read: b.read || 0,
            failed: b.failed || 0,
            startedAt: b.startedAt || null,
            completedAt: b.completedAt || null,
            defaultParams: b.defaultParams,
            createdById: agents[0]?.id || null,
          },
        });
        bCount++;
      }
    }
    console.log(`✅ ${bCount} broadcasts seeded`);
  }

  // ══════════════════════════════════════
  // Summary
  // ══════════════════════════════════════
  console.log("\n═════════════════════════════════");
  console.log("🎉 TEST DATA SEED COMPLETE!");
  console.log("═════════════════════════════════");
  console.log(`👤 Tenant login : ${TENANT_EMAIL} / ${TENANT_PASSWORD}`);
  console.log(`👨‍💼 Agent 1      : priya@demo.com / ${AGENT_PASSWORD}`);
  console.log(`👨‍💼 Agent 2      : rahul@demo.com / ${AGENT_PASSWORD}`);
  console.log(`👨‍💼 Agent 3      : sneha@demo.com / ${AGENT_PASSWORD}`);
  console.log(`🏷️  Tags         : ${tagData.length}`);
  console.log(`📇 Contacts      : ${contactData.length}`);
  console.log(`💬 Conversations : ${convCount} (${msgCount} messages)`);
  console.log(`📝 Templates     : ${createdTemplates.length}`);
  console.log(`⚡ Quick Replies : ${qrCount}`);
  console.log(`📢 Broadcasts    : 2`);
  console.log("═════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Test seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
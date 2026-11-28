// backend/src/modules/tenant/integrations/tenant.integrations.controller.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { encrypt, decrypt } from "../../../lib/crypto.js";
import redisClient from "../../../config/redis.js";
import { emitToTenant } from "../../../lib/socket.js";

export const getWhatsappCredentials = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const tenant = await prisma.tenantWhatsApp.findUnique({
      where: { tenantId },
      select: {
        whatsappPhoneId: true,
        whatsappWabaId: true,
        whatsappVerifyToken: true,
        whatsappAccessToken: true,
        whatsappCatalogId: true,
      },
    });

    if (tenant && tenant.whatsappAccessToken) {
      tenant.whatsappAccessToken = decrypt(tenant.whatsappAccessToken);
    }

    return res.status(200).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateWhatsappCredentials = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const { phoneId, wabaId, accessToken, verifyToken, catalogId } = req.body;

    const updated = await prisma.tenantWhatsApp.upsert({
      where: { tenantId },
      update: {
        whatsappPhoneId: phoneId,
        whatsappWabaId: wabaId,
        whatsappAccessToken: accessToken ? encrypt(accessToken) : undefined,
        whatsappVerifyToken: verifyToken,
        whatsappCatalogId: catalogId !== undefined ? catalogId : undefined,
      },
      create: {
        tenantId,
        whatsappPhoneId: phoneId,
        whatsappWabaId: wabaId,
        whatsappAccessToken: accessToken ? encrypt(accessToken) : undefined,
        whatsappVerifyToken: verifyToken,
        whatsappCatalogId: catalogId !== undefined ? catalogId : undefined,
      },
    });

    return res.status(200).json({
      success: true,
      message: "WhatsApp credentials updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMetaChannelsStatus = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const tenant = await prisma.tenantSocial.findUnique({
      where: { tenantId },
      select: {
        facebookPageId: true,
        facebookPageName: true,
        facebookPageAccessToken: true,
        instagramAccountId: true,
        instagramUsername: true,
      },
    });

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }

    const isFacebookConnected = Boolean(
      tenant.facebookPageId && tenant.facebookPageAccessToken,
    );
    const isInstagramConnected = Boolean(
      tenant.instagramAccountId || tenant.instagramUsername,
    );

    return res.status(200).json({
      success: true,
      data: {
        facebook: {
          connected: isFacebookConnected,
          pageId: tenant.facebookPageId || null,
          pageName: tenant.facebookPageName || null,
          hasToken: Boolean(tenant.facebookPageAccessToken),
        },
        instagram: {
          connected: isInstagramConnected,
          accountId: tenant.instagramAccountId || null,
          username: tenant.instagramUsername || null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const connectMetaChannels = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const {
      facebookPageId,
      facebookPageName,
      facebookPageAccessToken,
      instagramAccountId,
      instagramUsername,
    } = req.body;

    const updateData = {};
    if (facebookPageId !== undefined)
      updateData.facebookPageId = facebookPageId;
    if (facebookPageName !== undefined)
      updateData.facebookPageName = facebookPageName;
    if (facebookPageAccessToken) {
      updateData.facebookPageAccessToken = encrypt(facebookPageAccessToken);
    }
    if (instagramAccountId !== undefined)
      updateData.instagramAccountId = instagramAccountId;
    if (instagramUsername !== undefined)
      updateData.instagramUsername = instagramUsername;

    const updated = await prisma.tenantSocial.upsert({
      where: { tenantId },
      update: updateData,
      create: { tenantId, ...updateData },
      select: {
        facebookPageId: true,
        facebookPageName: true,
        instagramAccountId: true,
        instagramUsername: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Meta channels connected successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const disconnectMetaChannels = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const { channel } = req.body || {};

    const updateData = {};
    if (!channel || channel === "FACEBOOK") {
      updateData.facebookPageId = null;
      updateData.facebookPageName = null;
      updateData.facebookPageAccessToken = null;
    }
    if (!channel || channel === "INSTAGRAM") {
      updateData.instagramAccountId = null;
      updateData.instagramUsername = null;
    }

    await prisma.tenantSocial.update({
      where: { tenantId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Meta channel(s) disconnected successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getPaymentGatewayConfig = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const tenantRow = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subscription: {
          select: {
            razorpayAuthType: true,
            razorpayAccountId: true,
            razorpayAccountStatus: true,
            razorpayKycStatus: true,
            razorpayWebhookId: true,
            razorpayKeyId: true,
            razorpayKeySecret: true,
            razorpayWebhookSecret: true,
            enableOnlinePayment: true,
            enableCod: true,
            paymentLinkExpiryMins: true,
            defaultCurrency: true,
          },
        },
      },
    });
    const tenant = tenantRow
      ? { ...tenantRow, ...tenantRow.subscription }
      : null;

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }

    const host = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const webhookUrl = `${host}/sradmin/webhook/razorpay/order/${tenant.id}`;

    return res.status(200).json({
      success: true,
      data: {
        razorpayAuthType: tenant.razorpayAuthType || "DIRECT_KEYS",
        razorpayAccountId: tenant.razorpayAccountId || null,
        razorpayAccountStatus: tenant.razorpayAccountStatus || "DISCONNECTED",
        razorpayKycStatus: tenant.razorpayKycStatus || "PENDING",
        razorpayWebhookId: tenant.razorpayWebhookId || null,
        razorpayKeyId: tenant.razorpayKeyId || "",
        hasKeySecret: Boolean(tenant.razorpayKeySecret),
        hasWebhookSecret: Boolean(tenant.razorpayWebhookSecret),
        enableOnlinePayment: Boolean(tenant.enableOnlinePayment),
        enableCod: Boolean(tenant.enableCod),
        paymentLinkExpiryMins: tenant.paymentLinkExpiryMins || 30,
        defaultCurrency: tenant.defaultCurrency || "INR",
        webhookUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePaymentGatewayConfig = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const {
      razorpayAuthType,
      razorpayKeyId,
      razorpayKeySecret,
      razorpayWebhookSecret,
      enableOnlinePayment,
      enableCod,
      paymentLinkExpiryMins,
      defaultCurrency,
    } = req.body;

    const updateData = {};
    if (razorpayAuthType !== undefined) {
      updateData.razorpayAuthType =
        razorpayAuthType === "OAUTH" ? "OAUTH" : "DIRECT_KEYS";
    }
    if (razorpayKeyId !== undefined)
      updateData.razorpayKeyId = razorpayKeyId ? razorpayKeyId.trim() : null;
    if (razorpayKeySecret && razorpayKeySecret.trim() !== "") {
      updateData.razorpayKeySecret = encrypt(razorpayKeySecret.trim());
    }
    if (razorpayWebhookSecret && razorpayWebhookSecret.trim() !== "") {
      updateData.razorpayWebhookSecret = encrypt(razorpayWebhookSecret.trim());
    }
    if (enableOnlinePayment !== undefined)
      updateData.enableOnlinePayment = Boolean(enableOnlinePayment);
    if (enableCod !== undefined) updateData.enableCod = Boolean(enableCod);
    if (paymentLinkExpiryMins !== undefined)
      updateData.paymentLinkExpiryMins = Math.max(
        5,
        Math.min(1440, Number(paymentLinkExpiryMins) || 30),
      );
    if (defaultCurrency !== undefined)
      updateData.defaultCurrency = defaultCurrency || "INR";

    const updated = await prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: updateData,
      create: { tenantId, ...updateData },
    });

    const { invalidateTenantRazorpayCache } =
      await import("../../orders/order.payment.service.js");
    await invalidateTenantRazorpayCache(tenantId);

    return res.status(200).json({
      success: true,
      message: "Payment gateway settings updated successfully",
      data: {
        razorpayAuthType: updated.razorpayAuthType || "DIRECT_KEYS",
        razorpayKeyId: updated.razorpayKeyId,
        hasKeySecret: Boolean(updated.razorpayKeySecret),
        hasWebhookSecret: Boolean(updated.razorpayWebhookSecret),
        enableOnlinePayment: updated.enableOnlinePayment,
        enableCod: updated.enableCod,
        paymentLinkExpiryMins: updated.paymentLinkExpiryMins,
        defaultCurrency: updated.defaultCurrency,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const testPaymentGatewayConnection = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { razorpayKeyId, razorpayKeySecret } = req.body;

    let keyId = razorpayKeyId;
    let secret = razorpayKeySecret;

    if (!keyId || !secret) {
      const tenant = await prisma.tenantSubscription.findUnique({
        where: { tenantId },
        select: { razorpayKeyId: true, razorpayKeySecret: true },
      });
      if (!tenant?.razorpayKeyId || !tenant?.razorpayKeySecret) {
        return res.status(400).json({
          success: false,
          message:
            "Both Key ID and Key Secret are required to test connection.",
        });
      }
      keyId = tenant.razorpayKeyId;
      secret = decrypt(tenant.razorpayKeySecret);
    }

    const Razorpay = (await import("razorpay")).default;
    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: secret,
    });

    await rzp.payments.all({ count: 1 });

    return res.status(200).json({
      success: true,
      message:
        "Connection successful! Your Razorpay credentials are valid and active.",
    });
  } catch (error) {
    console.error("Razorpay test connection failed:", error.message);
    const isAuthError =
      error.statusCode === 401 ||
      (error.message && error.message.toLowerCase().includes("authenticate"));
    return res.status(400).json({
      success: false,
      message: isAuthError
        ? "Authentication failed: Invalid Razorpay Key ID or Key Secret."
        : `Connection failed: ${error.message}`,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /tenant/facebook/exchange-token
// One-click Facebook & Instagram connection (replaces manual paste)
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeFacebookToken = async (req, res) => {
  const { code } = req.body;
  const tenantId = req.tenant?.id;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Authorization code is required.",
    });
  }

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    return res.status(500).json({
      success: false,
      message: "Meta credentials not configured.",
    });
  }

  console.log("──────────────────────────────────────────────────");
  console.log("[Facebook] exchangeToken started");
  console.log("[Facebook] Code preview:", code.substring(0, 15) + "...");
  console.log("[Facebook] Tenant:", tenantId);
  console.log("──────────────────────────────────────────────────");

  try {
    // ── Step 1: Exchange code for short-lived user token ────────────
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`,
    );
    const tokenData = await tokenRes.json();

    console.log(
      "[Facebook] Token exchange response:",
      JSON.stringify(tokenData),
    );

    if (!tokenData?.access_token) {
      console.error("❌ Token exchange failed:", tokenData);
      return res.status(400).json({
        success: false,
        message: tokenData?.error?.message || "Failed to exchange code.",
        error_code: tokenData?.error?.code,
      });
    }

    let userAccessToken = tokenData.access_token;
    console.log("[Facebook] ✅ Short-lived token obtained");

    // ── Step 2: Convert to long-lived user token (60 days) ──────────
    const llParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: userAccessToken,
    });

    const llRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?${llParams.toString()}`,
    );
    const llData = await llRes.json();

    if (llData?.access_token) {
      userAccessToken = llData.access_token;
      console.log("[Facebook] ✅ Long-lived token obtained");
    } else {
      console.warn(
        "[Facebook] Could not extend token, using short-lived:",
        llData,
      );
    }

    // ── Step 3: Fetch Facebook Pages managed by this user ───────────
    const pagesRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`,
    );
    const pagesData = await pagesRes.json();

    console.log("[Facebook] Pages response:", JSON.stringify(pagesData));

    if (pagesData.error) {
      console.error("❌ Pages fetch failed:", pagesData.error);
      return res.status(400).json({
        success: false,
        message: pagesData.error.message || "Could not fetch Facebook Pages.",
      });
    }

    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No Facebook Pages found. Please create a Facebook Page first at facebook.com/pages/create",
      });
    }

    // ── Step 4: Check Instagram link for each Page ──────────────────
    const pagesWithIG = await Promise.all(
      pages.map(async (page) => {
        let igAccount = null;
        try {
          const igRes = await fetch(
            `https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`,
          );
          const igData = await igRes.json();
          if (igData.instagram_business_account) {
            igAccount = igData.instagram_business_account;
          }
        } catch (e) {
          console.warn(
            `[Facebook] IG check failed for page ${page.id}:`,
            e.message,
          );
        }
        return { ...page, instagram: igAccount };
      }),
    );

    console.log(
      "[Facebook] Pages with IG:",
      JSON.stringify(pagesWithIG, null, 2),
    );

    // ── Step 5: If only one page → auto-connect ─────────────────────
    if (pagesWithIG.length === 1) {
      const page = pagesWithIG[0];
      return await saveFacebookConnection(res, page, tenantId);
    }

    // ── Step 6: Multiple pages → store token in Redis, return list ──
    const redisKey = `fb:user_token:${tenantId}`;
    await redisClient.set(redisKey, userAccessToken, "EX", 300);

    return res.json({
      success: true,
      requiresSelection: true,
      pages: pagesWithIG.map((p) => ({
        id: p.id,
        name: p.name,
        instagramUsername: p.instagram?.username || null,
      })),
    });
  } catch (err) {
    console.error("❌ exchangeFacebookToken error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during token exchange.",
    });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /tenant/facebook/select-page
// Called after user picks a Page from selector (multi-page case)
// ─────────────────────────────────────────────────────────────────────────────
export const selectFacebookPage = async (req, res) => {
  const { pageId } = req.body;
  const tenantId = req.tenant?.id;

  if (!pageId) {
    return res.status(400).json({
      success: false,
      message: "pageId is required.",
    });
  }

  try {
    const redisKey = `fb:user_token:${tenantId}`;
    const userAccessToken = await redisClient.get(redisKey);

    if (!userAccessToken) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please try connecting again.",
      });
    }

    const pagesRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`,
    );
    const pagesData = await pagesRes.json();

    const page = pagesData.data?.find((p) => p.id === pageId);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Selected page not found or not accessible.",
      });
    }

    // Get Instagram link
    let igAccount = null;
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`,
      );
      const igData = await igRes.json();
      if (igData.instagram_business_account) {
        igAccount = igData.instagram_business_account;
      }
    } catch (e) {
      console.warn("[Facebook] IG check failed:", e.message);
    }

    // Clean up Redis
    await redisClient.del(redisKey);

    return await saveFacebookConnection(
      res,
      { ...page, instagram: igAccount },
      tenantId,
    );
  } catch (err) {
    console.error("❌ selectFacebookPage error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during page selection.",
    });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Helper: Save connection + subscribe webhooks + emit socket
// Shared by exchangeFacebookToken and selectFacebookPage
// ─────────────────────────────────────────────────────────────────────────────
const saveFacebookConnection = async (res, page, tenantId) => {
  // ── Check duplicate ──────────────────────────────────────────────
  const existingTenant = await prisma.tenantSocial.findFirst({
    where: {
      facebookPageId: page.id,
      NOT: { tenantId },
    },
    select: { tenantId: true },
  });

  if (existingTenant) {
    const existingTenantData = await prisma.tenant.findUnique({
      where: { id: existingTenant.tenantId },
      select: { tenantName: true },
    });
    return res.status(400).json({
      success: false,
      message: `This Facebook Page is already connected to ${existingTenantData?.tenantName || "another account"}.`,
    });
  }

  // ── Subscribe Page to webhooks ───────────────────────────────────
  try {
    const subRes = await fetch(
      `https://graph.facebook.com/v22.0/${page.id}/subscribed_apps`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${page.access_token}` },
      },
    );
    const subData = await subRes.json();
    console.log("[Facebook] Webhook subscription:", subData);
  } catch (e) {
    console.warn(
      "[Facebook] Webhook subscription failed (non-fatal):",
      e.message,
    );
  }

  // ── Save to DB (token encrypted at rest) ─────────────────────────
  await prisma.tenantSocial.upsert({
    where: { tenantId },
    create: {
      tenantId,
      facebookPageId: page.id,
      facebookPageName: page.name,
      facebookPageAccessToken: encrypt(page.access_token),
      instagramAccountId: page.instagram?.id || null,
      instagramUsername: page.instagram?.username || null,
    },
    update: {
      facebookPageId: page.id,
      facebookPageName: page.name,
      facebookPageAccessToken: encrypt(page.access_token),
      instagramAccountId: page.instagram?.id || null,
      instagramUsername: page.instagram?.username || null,
    },
  });

  console.log(`[Facebook] ✅ Tenant ${tenantId} connected — ${page.name}`);

  // 📡 Real-time socket emit
  emitToTenant(tenantId, "meta_channels_status_changed", {
    facebook: {
      connected: true,
      pageId: page.id,
      pageName: page.name,
    },
    instagram: {
      connected: Boolean(page.instagram),
      username: page.instagram?.username || null,
    },
  });

  return res.json({
    success: true,
    message: "Facebook & Instagram connected successfully.",
    facebook: {
      pageId: page.id,
      pageName: page.name,
    },
    instagram: {
      connected: Boolean(page.instagram),
      accountId: page.instagram?.id || null,
      username: page.instagram?.username || null,
    },
  });
};
import prisma from "../../config/prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// Receives an authorization code from the popup OAuth flow (whatsapp-callback.html).
// The popup opens Meta's OAuth dialog with redirect_uri=.../whatsapp-callback,
// which redirects the code to our callback page. The code is exchanged here
// with the exact same redirect_uri, which Meta validates and accepts.
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeToken = async (req, res) => {
  const {
    code,
    accessToken: directToken,
    phoneNumberId: reqPhoneId,
    wabaId: reqWabaId,
  } = req.body;

  const tenantId = req.tenantId;

  if (!code && !directToken) {
    return res.status(400).json({
      success: false,
      message: "Either code or accessToken is required.",
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
  if (directToken) {
    console.log("[WhatsApp] Token exchange started (DIRECT token — test mode)");
    console.log(
      "[WhatsApp] Token preview:",
      directToken.substring(0, 15) + "...",
    );
  } else {
    console.log("[WhatsApp] Token exchange started (FB.login code flow)");
    console.log("[WhatsApp] Code preview:", code.substring(0, 15) + "...");
  }
  console.log("──────────────────────────────────────────────────");

  try {
    let businessToken = directToken || process.env.META_SYSTEM_USER_TOKEN;

    if (!businessToken) {
      console.error('❌ META_SYSTEM_USER_TOKEN not set');
      return res.status(500).json({
        success: false,
        message: 'META_SYSTEM_USER_TOKEN is not configured on the server.',
      });
    }

    console.log('[WhatsApp] 🔄 Using System User Access Token flow.');

    /*
    // ── Code Exchange Flow Disabled ───────────────────────────────────
    if (!directToken && code) {
      const redirectUri = process.env.META_REDIRECT_URI || "";
      const params = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      });
      const tokenRes = await fetch(
        `https://graph.facebook.com/v25.0/oauth/access_token?${params.toString()}`
      );
      const tokenData = await tokenRes.json();
      if (tokenData?.access_token) {
        businessToken = tokenData.access_token;
      }
    }
    // ──────────────────────────────────────────────────────────────────
    */

    console.log("[WhatsApp] ✅ Access token ready!");

    // ─── Resolve WABA ID ──────────────────────────────────────────────
    let wabaId = reqWabaId || null;
    let phoneNumberId = reqPhoneId || null;
    let displayPhoneNumber = null;
    let verifiedName = null;

    if (!wabaId) {
      console.log('[WhatsApp] Resolving WABA from token debug...');
      try {
        const debugRes = await fetch(
          `https://graph.facebook.com/debug_token` +
          `?input_token=${businessToken}` +
          `&access_token=${appId}|${appSecret}`
        );
        const debugData = await debugRes.json();
        console.log('[WhatsApp] Granular scopes:', JSON.stringify(debugData?.data?.granular_scopes));

        wabaId = debugData.data?.granular_scopes
          ?.find(s => s.scope === 'whatsapp_business_management')
          ?.target_ids?.[0] || null;
      } catch (e) {
        console.warn('[WhatsApp] debug_token lookup failed:', e.message);
      }

      if (!wabaId) {
        try {
          const meRes = await fetch(
            `https://graph.facebook.com/v25.0/me?fields=whatsapp_business_accounts,client_whatsapp_business_accounts&access_token=${businessToken}`
          );
          const meData = await meRes.json();
          wabaId = meData.whatsapp_business_accounts?.data?.[0]?.id || 
                 meData.client_whatsapp_business_accounts?.data?.[0]?.id || null;
        } catch (e) {
          console.warn('[WhatsApp] me accounts lookup failed:', e.message);
        }
      }

      console.log("[WhatsApp] Resolved WABA ID:", wabaId);
    }

    // ─── Resolve Phone Number ─────────────────────────────────────────
    if (wabaId && !phoneNumberId) {
      console.log(`[WhatsApp] Fetching phones for WABA ${wabaId}...`);
      const phoneRes = await fetch(
        `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?access_token=${businessToken}`,
      );
      const phoneData = await phoneRes.json();
      console.log("[WhatsApp] Phones:", JSON.stringify(phoneData));

      const first = phoneData.data?.[0];
      phoneNumberId = first?.id || null;
      displayPhoneNumber = first?.display_phone_number || null;
      verifiedName = first?.verified_name || null;
    } else if (phoneNumberId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v25.0/${phoneNumberId}?access_token=${businessToken}`,
      );
      const phoneData = await phoneRes.json();
      displayPhoneNumber = phoneData.display_phone_number || null;
      verifiedName = phoneData.verified_name || null;
    }

    if (!phoneNumberId || !wabaId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine WhatsApp Account or Phone Number ID.",
      });
    }

    console.log("[WhatsApp] IDs resolved:", {
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
    });

    // ─── Step 2: Subscribe to webhooks ───────────────────────────────
    try {
      console.log(`[WhatsApp] Subscribing to webhooks on WABA ${wabaId}...`);
      const subRes = await fetch(
        `https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${businessToken}` },
        },
      );
      const subData = await subRes.json();
      console.log("[WhatsApp] Webhook subscription:", subData);
    } catch (e) {
      console.warn(
        "[WhatsApp] Webhook subscription failed (non-fatal):",
        e.message,
      );
    }

    // ─── Step 3: Register phone number ───────────────────────────────
    try {
      console.log(`[WhatsApp] Registering phone ${phoneNumberId}...`);
      const regRes = await fetch(
        `https://graph.facebook.com/v25.0/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${businessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            pin: process.env.WA_DEFAULT_PIN || "123456",
          }),
        },
      );
      const regData = await regRes.json();
      console.log("[WhatsApp] Registration:", regData);
    } catch (e) {
      console.warn("[WhatsApp] Registration failed (non-fatal):", e.message);
    }

    // ─── Step 4: Check duplicates ─────────────────────────────────────
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        whatsappPhoneId: phoneNumberId,
        NOT: { id: tenantId },
      },
      select: { id: true, tenantName: true },
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: `This number is already connected to ${existingTenant.tenantName}.`,
      });
    }

    // ─── Step 5: Save to DB ───────────────────────────────────────────
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappWabaId: wabaId,
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: businessToken,
      },
    });

    console.log(
      `[WhatsApp] ✅ Connected tenant ${tenantId} | ${displayPhoneNumber}`,
    );

    return res.json({
      success: true,
      message: "WhatsApp connected successfully.",
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
    });
  } catch (err) {
    console.error("❌ exchangeToken error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during token exchange.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/setup
// Called when Meta sends a WA_EMBEDDED_SIGNUP FINISH postMessage to the page.
// Directly saves the phone_number_id and waba_id to the tenant record.
// ─────────────────────────────────────────────────────────────────────────────
export const setupWhatsApp = async (req, res) => {
  const { phoneNumberId, wabaId } = req.body;
  const tenantId = req.tenantId;

  if (!phoneNumberId || !wabaId) {
    return res.status(400).json({
      success: false,
      message: "phoneNumberId and wabaId are required.",
    });
  }

  try {
    // ✅ Check for existing connection (prevent duplicates)
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        whatsappPhoneId: phoneNumberId,
        NOT: { id: tenantId },
      },
      select: { id: true, tenantName: true },
    });

    if (existingTenant) {
      console.log(`⚠️ Duplicate connection attempt:
        Phone: ${phoneNumberId}
        Already used by: ${existingTenant.tenantName} (${existingTenant.id})
        Requested by: ${tenantId}`);

      return res.status(400).json({
        success: false,
        message: `This WhatsApp number is already connected to another account (${existingTenant.tenantName}). Please disconnect it there first or use a different number.`,
      });
    }

    const accessToken = process.env.META_SYSTEM_USER_TOKEN;

    if (!accessToken) {
      console.error("❌ META_SYSTEM_USER_TOKEN not set");
      return res.status(500).json({
        success: false,
        message: "System configuration error",
      });
    }

    // Verify credentials work
    console.log("[WhatsApp] Verifying with system user token...");
    const verifyRes = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}?access_token=${accessToken}`,
    );
    const verifyData = await verifyRes.json();

    if (verifyData.error) {
      console.error("[WhatsApp] Verification failed:", verifyData.error);
      return res.status(400).json({
        success: false,
        message: `Verification failed: ${verifyData.error.message}`,
      });
    }

    console.log("[WhatsApp] ✅ Verified:", verifyData.display_phone_number);

    // Save to database
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhoneId: phoneNumberId,
        whatsappWabaId: wabaId,
        whatsappAccessToken: accessToken,
      },
    });

    console.log(`✅ WhatsApp connected for tenant ${tenantId}`);

    return res.json({
      success: true,
      message: "WhatsApp connected successfully",
      wabaId,
      phoneNumberId,
      displayPhoneNumber: verifyData.display_phone_number,
      verifiedName: verifyData.verified_name,
    });
  } catch (err) {
    console.error("❌ setupWhatsApp error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api2/whatsapp/status
// Returns whether this tenant already has a WhatsApp number connected.
// ─────────────────────────────────────────────────────────────────────────────
export const getWhatsAppStatus = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneId: true,
        whatsappWabaId: true,
        // Never return the access token to the frontend
      },
    });

    const isConnected = !!(tenant?.whatsappPhoneId && tenant?.whatsappWabaId);

    return res.json({
      success: true,
      isConnected,
      phoneNumberId: tenant?.whatsappPhoneId || null,
      wabaId: tenant?.whatsappWabaId || null,
    });
  } catch (err) {
    console.error("❌ getWhatsAppStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api2/whatsapp/my-wabas
// Fetches user's existing WABAs using System User token
// Used as fallback when Embedded Signup popup closes without FINISH event
// ─────────────────────────────────────────────────────────────────────────────
export const getMyWabas = async (req, res) => {
  try {
    const accessToken = process.env.META_SYSTEM_USER_TOKEN;

    if (!accessToken) {
      console.error("❌ META_SYSTEM_USER_TOKEN not configured");
      return res.status(500).json({
        success: false,
        message: "System token not configured",
      });
    }

    let discoveredWabaIds = [];

    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v25.0/me?fields=whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}&access_token=${accessToken}`
      );
      const meData = await meRes.json();
      if (meData.whatsapp_business_accounts?.data) {
        discoveredWabaIds.push(...meData.whatsapp_business_accounts.data.map(w => w.id));
      }
      if (meData.client_whatsapp_business_accounts?.data) {
        discoveredWabaIds.push(...meData.client_whatsapp_business_accounts.data.map(w => w.id));
      }
    } catch (e) {
      console.warn('[WhatsApp] Dynamic WABA lookup failed:', e.message);
    }

    if (discoveredWabaIds.length === 0 && process.env.META_WABA_ID) {
      discoveredWabaIds.push(process.env.META_WABA_ID);
    }
    if (discoveredWabaIds.length === 0) {
      discoveredWabaIds.push('1309651157196821');
    }

    const WABA_IDS = [...new Set(discoveredWabaIds)];

    const wabas = [];

    for (const wabaId of WABA_IDS) {
      try {
        // Get WABA info
        const wabaRes = await fetch(
          `https://graph.facebook.com/v25.0/${wabaId}?access_token=${accessToken}`,
        );
        const wabaData = await wabaRes.json();

        if (wabaData.error) {
          console.error(`Error fetching WABA ${wabaId}:`, wabaData.error);
          continue;
        }

        // Get phone numbers
        const phoneRes = await fetch(
          `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
        );
        const phoneData = await phoneRes.json();

        wabas.push({
          id: wabaData.id,
          name: wabaData.name,
          phones: phoneData.data || [],
        });
      } catch (err) {
        console.error(`Error processing WABA ${wabaId}:`, err);
      }
    }

    console.log("[WhatsApp] Available WABAs:", JSON.stringify(wabas, null, 2));

    return res.json({
      success: true,
      wabas,
    });
  } catch (err) {
    console.error("❌ getMyWabas error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/disconnect
// Disconnects WhatsApp from the current tenant
// ─────────────────────────────────────────────────────────────────────────────
export const disconnectWhatsApp = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    // Get tenant info before disconnecting
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        tenantName: true,
        whatsappPhoneId: true,
        whatsappWabaId: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!tenant.whatsappPhoneId) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp is not connected",
      });
    }

    // Disconnect WhatsApp
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhoneId: null,
        whatsappWabaId: null,
        whatsappAccessToken: null,
      },
    });

    console.log(
      `✅ WhatsApp disconnected for tenant ${tenantId} (${tenant.tenantName})`,
    );
    console.log(`   Removed Phone ID: ${tenant.whatsappPhoneId}`);
    console.log(`   Removed WABA ID: ${tenant.whatsappWabaId}`);

    return res.json({
      success: true,
      message: "WhatsApp disconnected successfully",
    });
  } catch (err) {
    console.error("❌ disconnectWhatsApp error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during disconnect",
    });
  }
};

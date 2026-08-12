import prisma from '../../config/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { sendLocationService } from './whatsappService.js';
import { emitToTenant, emitToUser } from '../../lib/socket.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeToken = async (req, res) => {
  const {
    code,
    phoneNumberId: reqPhoneId,
    wabaId: reqWabaId,
    pin,
  } = req.body;

  if (!pin) {
    return res.status(400).json({
      success: false,
      message: "A 6-digit 2FA PIN is required to register your WhatsApp phone number.",
    });
  }

  const tenantId = req.tenantId;

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
  console.log("[WhatsApp] exchangeToken started");
  console.log("[WhatsApp] Code preview:", code.substring(0, 15) + "...");
  console.log("[WhatsApp] reqPhoneId:", reqPhoneId);
  console.log("[WhatsApp] reqWabaId:", reqWabaId);
  console.log("──────────────────────────────────────────────────");

  try {

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
    });

    console.log("[WhatsApp] Calling graph.facebook.com/oauth/access_token...");
    console.log("[WhatsApp] No redirect_uri — Tech Provider flow");

    const tokenRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`
    );
    const tokenData = await tokenRes.json();

    console.log("[WhatsApp] Token exchange raw response:", JSON.stringify(tokenData));

    if (!tokenData?.access_token) {
      console.error("❌ Token exchange failed:", tokenData);
      return res.status(400).json({
        success: false,
        message: tokenData?.error?.message || "Failed to exchange code.",
        error_code: tokenData?.error?.code,
        error_subcode: tokenData?.error?.error_subcode,
      });
    }

    let accessToken = tokenData.access_token;
    console.log("[WhatsApp] ✅ Short-lived token obtained");

    // ── Step 2: Extend to long-lived token ───────────────────────────
    const llParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: accessToken,
    });

    const llRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?${llParams.toString()}`
    );
    const llData = await llRes.json();

    if (llData?.access_token) {
      accessToken = llData.access_token;
      console.log("[WhatsApp] ✅ Long-lived token obtained");
    } else {
      console.warn("[WhatsApp] Could not extend token, using short-lived:", llData);
    }

    // ── Step 3: Resolve WABA ID from token if not provided ───────────
    let wabaId = reqWabaId || null;
    let phoneNumberId = reqPhoneId || null;
    let displayPhoneNumber = null;
    let verifiedName = null;

    if (!wabaId) {
      console.log("[WhatsApp] Resolving WABA from debug_token...");
      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token` +
        `?input_token=${accessToken}` +
        `&access_token=${appId}|${appSecret}`
      );
      const debugData = await debugRes.json();
      console.log(
        "[WhatsApp] debug_token granular_scopes:",
        JSON.stringify(debugData?.data?.granular_scopes)
      );

      wabaId =
        debugData.data?.granular_scopes?.find(
          (s) => s.scope === "whatsapp_business_management"
        )?.target_ids?.[0] || null;

      console.log("[WhatsApp] Resolved wabaId:", wabaId);
    }

    // ── Step 4: Resolve phone number if not provided ─────────────────
    if (wabaId && !phoneNumberId) {
      console.log(`[WhatsApp] Fetching phones for WABA ${wabaId}...`);
      const phoneRes = await fetch(
        `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers?access_token=${accessToken}`
      );
      const phoneData = await phoneRes.json();
      console.log("[WhatsApp] Phones response:", JSON.stringify(phoneData));

      const first = phoneData.data?.[0];
      phoneNumberId = first?.id || null;
      displayPhoneNumber = first?.display_phone_number || null;
      verifiedName = first?.verified_name || null;
    } else if (phoneNumberId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v22.0/${phoneNumberId}?access_token=${accessToken}`
      );
      const phoneData = await phoneRes.json();
      displayPhoneNumber = phoneData.display_phone_number || null;
      verifiedName = phoneData.verified_name || null;
    }

    if (!phoneNumberId || !wabaId) {
      console.error("[WhatsApp] Could not resolve phoneNumberId or wabaId");
      return res.status(400).json({
        success: false,
        message:
          "Could not determine WhatsApp Account or Phone Number. Please complete the Meta setup fully.",
      });
    }

    console.log("[WhatsApp] Final IDs:", {
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
    });

    // ── Step 5: Check duplicate ───────────────────────────────────────
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

    // ── Step 6: Subscribe WABA to webhooks ───────────────────────────
    try {
      const subRes = await fetch(
        `https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const subData = await subRes.json();
      console.log("[WhatsApp] Webhook subscription:", subData);
    } catch (e) {
      console.warn(
        "[WhatsApp] Webhook subscription failed (non-fatal):",
        e.message
      );
    }

    // ── Step 6.5: Register Phone Number with Meta ─────────────────────
    try {
      console.log(`[WhatsApp] Registering phone number ${phoneNumberId}...`);
      const regRes = await fetch(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            pin,
          }),
        }
      );
      const regData = await regRes.json();
      console.log("[WhatsApp] Phone registration response:", regData);
    } catch (e) {
      console.warn("[WhatsApp] Phone registration failed (non-fatal):", e.message);
    }

    // ── Step 7: Save to DB (token encrypted at rest) ─────────────────────────────────
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappWabaId: wabaId,
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: encrypt(accessToken), // ✅ always encrypted at rest
      },
    });

    console.log(
      `[WhatsApp] ✅ Tenant ${tenantId} connected — ${displayPhoneNumber}`
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

    console.log("[WhatsApp] Verifying with system user token...");
    const verifyRes = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}?access_token=${accessToken}`
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

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhoneId: phoneNumberId,
        whatsappWabaId: wabaId,
        whatsappAccessToken: encrypt(accessToken),
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
// ─────────────────────────────────────────────────────────────────────────────
export const getWhatsAppStatus = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneId: true,
        whatsappWabaId: true,
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

    const WABA_IDS = ["1309651157196821"];
    const wabas = [];

    for (const wabaId of WABA_IDS) {
      try {
        const wabaRes = await fetch(
          `https://graph.facebook.com/v25.0/${wabaId}?access_token=${accessToken}`
        );
        const wabaData = await wabaRes.json();

        if (wabaData.error) {
          console.error(`Error fetching WABA ${wabaId}:`, wabaData.error);
          continue;
        }

        const phoneRes = await fetch(
          `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?access_token=${accessToken}`
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
// ─────────────────────────────────────────────────────────────────────────────
export const disconnectWhatsApp = async (req, res) => {
  const tenantId = req.tenantId;

  try {
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

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhoneId: null,
        whatsappWabaId: null,
        whatsappAccessToken: null,
      },
    });

    console.log(
      `✅ WhatsApp disconnected for tenant ${tenantId} (${tenant.tenantName})`
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/register-phone
// Calls Meta Graph API /{PHONE_NUMBER_ID}/register to activate Cloud API container
// ─────────────────────────────────────────────────────────────────────────────
export const registerPhoneNumber = async (req, res) => {
  const tenantId = req.tenantId;
  const { pin } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneId: true,
        whatsappAccessToken: true,
      },
    });

    if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
      return res.status(400).json({
        success: false,
        message: "No connected WhatsApp phone number found for this tenant.",
      });
    }

    console.log(`[WhatsApp] Registering phone number ${tenant.whatsappPhoneId} with Meta...`);

    const regRes = await fetch(
      `https://graph.facebook.com/v22.0/${tenant.whatsappPhoneId}/register`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${decrypt(tenant.whatsappAccessToken)}`, // ✅ always decrypt before use
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin,
        }),
      }
    );
    const regData = await regRes.json();
    console.log("[WhatsApp] Phone registration response:", regData);

    if (regData.error) {
      return res.status(400).json({
        success: false,
        message: regData.error.message || "Failed to register phone number with Meta.",
        error: regData.error,
      });
    }

    return res.json({
      success: true,
      message: "Phone number successfully registered with Meta Cloud API.",
      data: regData,
    });
  } catch (err) {
    console.error("❌ registerPhoneNumber error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while registering phone number.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/send-location
// ─────────────────────────────────────────────────────────────────────────────
export const sendLocation = async (req, res) => {
        try {
          const {
            to,
            latitude,
            longitude,
            name,
            address,
            conversationId,
          } = req.body;

          const tenantId = req.tenantId;
          const userType = req.userType;

          // ── Identify sender ──────────────────────────────────────
          // Same pattern as sendMessage in messageController.js
          let senderId = null;
          let senderType = null;

          if (userType === 'TENANT' && req.tenant) {
            senderId = req.tenant.id;
            senderType = 'TENANT';
          } else if (userType === 'USER' && req.user) {
            senderId = req.user.id;
            senderType = 'USER';
          }

          if (!senderId) {
            return res.status(401).json({
              success: false,
              message: 'Unable to identify sender',
            });
          }

          // ── Call service ─────────────────────────────────────────
          const result = await sendLocationService({
            tenantId,
            to,
            latitude,
            longitude,
            name,
            address,
            conversationId,
            senderId,
            senderType,
          });

          // ── Socket emit ──────────────────────────────────────────
          if (result.message && conversationId) {
            const socketPayload = {
              conversationId,
              message: {
                id: result.message.id,
                type: 'LOCATION',
                direction: 'OUTBOUND',
                senderType,
                senderId,
                isFromCustomer: false,
                locLatitude: parseFloat(latitude),
                locLongitude: parseFloat(longitude),
                locName: name || null,
                locAddress: address || null,
                status: 'sent',
                createdAt: result.message.createdAt,
              },
            };

            emitToTenant(tenantId, 'new_message', socketPayload);

            if (userType === 'USER' && req.user?.id) {
              emitToUser(req.user.id, 'new_message', socketPayload);
            }
          }

          return res.status(200).json({
            success: true,
            message: 'Location sent successfully',
            data: {
              waMessageId: result.waMessageId,
              messageId: result.message?.id || null,
            },
          });

        } catch (error) {
          console.error('❌ sendLocation error:', error.message);
          return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send location',
          });
        }
      };
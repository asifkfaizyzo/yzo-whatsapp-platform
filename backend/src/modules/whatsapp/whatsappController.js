import prisma from '../../config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// Receives an authorization code from the frontend Embedded Signup,
// exchanges it for an access token, extends to long-lived token,
// fetches WABA/Phone/Business info, and saves to the tenant.
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeToken = async (req, res) => {
  const { code, phoneNumberId: reqPhoneId, wabaId: reqWabaId } = req.body;
  const tenantId = req.tenantId;

  if (!code) {
    return res.status(400).json({ 
      success: false, 
      message: 'Authorization code is required.' 
    });
  }

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    console.error('❌ META_APP_ID or META_APP_SECRET not set in environment.');
    return res.status(500).json({ 
      success: false, 
      message: 'Meta credentials not configured on backend.' 
    });
  }

  console.log('──────────────────────────────────────────────────');
  console.log('[WhatsApp Tech Provider] Onboarding customer...');
  console.log('──────────────────────────────────────────────────');

  try {
    const appId = (process.env.META_APP_ID || '').trim();
    const appSecret = (process.env.META_APP_SECRET || '').trim();

    console.log(`[WhatsApp Tech Provider] App ID: ${appId}, App Secret length: ${appSecret.length}`);

    // ─── Step 1: Exchange code for business token (Meta Tech Provider spec) ───
    const targetRedirectUri = req.body.redirectUri || req.body.originUri || req.headers.origin || 'https://sudoreply.com/';
    console.log(`[WhatsApp Tech Provider] Exchanging code with redirect_uri: "${targetRedirectUri}"...`);

    const exchangeParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: targetRedirectUri,
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${exchangeParams.toString()}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('❌ Token exchange failed:', tokenData);
      return res.status(400).json({
        success: false,
        message: tokenData.error?.message || 'Failed to exchange authorization code with Meta.'
      });
    }

    const businessToken = tokenData.access_token;
    console.log('[WhatsApp Tech Provider] ✅ Business token acquired successfully!');

    // ─── Resolve WABA ID and Phone Number ID ───
    let wabaId = reqWabaId || null;
    let phoneNumberId = reqPhoneId || null;

    if (!wabaId) {
      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token` +
        `?input_token=${businessToken}` +
        `&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
      );
      const debugData = await debugRes.json();

      const wabaIds = debugData.data?.granular_scopes?.find(
        (s) => s.scope === 'whatsapp_business_management'
      )?.target_ids || [];

      wabaId = wabaIds[0] || null;
    }

    let displayPhoneNumber = null;
    let verifiedName = null;

    if (wabaId && !phoneNumberId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?access_token=${businessToken}`
      );
      const phoneData = await phoneRes.json();
      const firstPhone = phoneData.data?.[0];
      phoneNumberId = firstPhone?.id || null;
      displayPhoneNumber = firstPhone?.display_phone_number || null;
      verifiedName = firstPhone?.verified_name || null;
    } else if (phoneNumberId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v25.0/${phoneNumberId}?access_token=${businessToken}`
      );
      const phoneData = await phoneRes.json();
      displayPhoneNumber = phoneData.display_phone_number || null;
      verifiedName = phoneData.verified_name || null;
    }

    if (!phoneNumberId || !wabaId) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine WhatsApp Account ID or Phone Number ID.'
      });
    }

    // ─── Step 2: Subscribe App to Webhooks on Customer WABA ───
    console.log(`[WhatsApp] Subscribing app to webhooks on WABA ${wabaId}...`);
    try {
      const subRes = await fetch(
        `https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const subData = await subRes.json();
      console.log('[WhatsApp] Webhook subscription response:', subData);
    } catch (subErr) {
      console.warn('[WhatsApp] Webhook subscription warning:', subErr.message);
    }

    // ─── Step 3: Register Customer Phone Number ───
    console.log(`[WhatsApp] Registering phone number ${phoneNumberId}...`);
    try {
      const regRes = await fetch(
        `https://graph.facebook.com/v25.0/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: '123456'
          })
        }
      );
      const regData = await regRes.json();
      console.log('[WhatsApp] Phone registration response:', regData);
    } catch (regErr) {
      console.warn('[WhatsApp] Phone registration warning:', regErr.message);
    }

    if (!phoneNumberId || !wabaId) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine WhatsApp Account ID or Phone Number ID.'
      });
    }

    // ─── Step 4: Check for duplicate connection ───
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        whatsappPhoneId: phoneNumberId,
        NOT: { id: tenantId },
      },
      select: { id: true, tenantName: true }
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: `This WhatsApp number is already connected to another tenant (${existingTenant.tenantName}).`
      });
    }

    // ─── Step 5: Save to DB ───
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappWabaId: wabaId,
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: businessToken,
      },
    });

    console.log(`[WhatsApp] ✅ Connected successfully via token exchange for tenant ${tenantId}`);

    return res.json({
      success: true,
      message: 'WhatsApp Business account connected successfully.',
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
    });

  } catch (err) {
    console.error('❌ exchangeToken error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during token exchange.' 
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
      message: 'phoneNumberId and wabaId are required.',
    });
  }

  try {
    // ✅ Check for existing connection (prevent duplicates)
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        whatsappPhoneId: phoneNumberId,
        NOT: { id: tenantId },
      },
      select: { id: true, tenantName: true }
    });

    if (existingTenant) {
      console.log(`⚠️ Duplicate connection attempt:
        Phone: ${phoneNumberId}
        Already used by: ${existingTenant.name} (${existingTenant.id})
        Requested by: ${tenantId}`);

      return res.status(400).json({
        success: false,
        message: `This WhatsApp number is already connected to another account (${existingTenant.name}). Please disconnect it there first or use a different number.`,
      });
    }

    const accessToken = process.env.META_SYSTEM_USER_TOKEN;

    if (!accessToken) {
      console.error('❌ META_SYSTEM_USER_TOKEN not set');
      return res.status(500).json({
        success: false,
        message: 'System configuration error'
      });
    }

    // Verify credentials work
    console.log('[WhatsApp] Verifying with system user token...');
    const verifyRes = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}?access_token=${accessToken}`
    );
    const verifyData = await verifyRes.json();

    if (verifyData.error) {
      console.error('[WhatsApp] Verification failed:', verifyData.error);
      return res.status(400).json({
        success: false,
        message: `Verification failed: ${verifyData.error.message}`,
      });
    }

    console.log('[WhatsApp] ✅ Verified:', verifyData.display_phone_number);

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
      message: 'WhatsApp connected successfully',
      wabaId,
      phoneNumberId,
      displayPhoneNumber: verifyData.display_phone_number,
      verifiedName: verifyData.verified_name,
    });

  } catch (err) {
    console.error('❌ setupWhatsApp error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
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
    console.error('❌ getWhatsAppStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
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
      console.error('❌ META_SYSTEM_USER_TOKEN not configured');
      return res.status(500).json({
        success: false,
        message: 'System token not configured'
      });
    }

    // Your known WABA IDs (add more if you have multiple)
    const WABA_IDS = ['1309651157196821'];

    const wabas = [];

    for (const wabaId of WABA_IDS) {
      try {
        // Get WABA info
        const wabaRes = await fetch(
          `https://graph.facebook.com/v25.0/${wabaId}?access_token=${accessToken}`
        );
        const wabaData = await wabaRes.json();

        if (wabaData.error) {
          console.error(`Error fetching WABA ${wabaId}:`, wabaData.error);
          continue;
        }

        // Get phone numbers
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

    console.log('[WhatsApp] Available WABAs:', JSON.stringify(wabas, null, 2));

    return res.json({
      success: true,
      wabas,
    });

  } catch (err) {
    console.error('❌ getMyWabas error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
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
        whatsappWabaId: true 
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    if (!tenant.whatsappPhoneId) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not connected'
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

    console.log(`✅ WhatsApp disconnected for tenant ${tenantId} (${tenant.name})`);
    console.log(`   Removed Phone ID: ${tenant.whatsappPhoneId}`);
    console.log(`   Removed WABA ID: ${tenant.whatsappWabaId}`);

    return res.json({
      success: true,
      message: 'WhatsApp disconnected successfully',
    });

  } catch (err) {
    console.error('❌ disconnectWhatsApp error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during disconnect',
    });
  }
};

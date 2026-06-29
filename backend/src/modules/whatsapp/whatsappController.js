import prisma from '../../config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// Receives the auth code from the frontend (returned by FB.login()),
// exchanges it for an access token on the backend (keeps APP_SECRET safe),
// then fetches the WABA ID + Phone Number ID and saves them to the tenant.
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeToken = async (req, res) => {
  const { code, redirectUri } = req.body;
  const tenantId = req.tenantId;

  if (!code) {
    return res.status(400).json({ 
      success: false, 
      message: 'Auth code is required.' 
    });
  }

  // Try the dynamically passed redirectUri first, then fallbacks
  const redirectUrisToTry = [];
  if (redirectUri) {
    redirectUrisToTry.push(redirectUri);
  }
  redirectUrisToTry.push(
    "", // Empty string
    "https://www.sudoreply.com/",
    "https://www.sudoreply.com",
    "https://sudoreply.com/",
    "https://sudoreply.com"
  );

  let access_token = null;
  let successRedirectUri = null;

  for (const redirectUri of redirectUrisToTry) {
    try {
      const params = new URLSearchParams({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        code,
      });

      // Only add redirect_uri if not empty
      if (redirectUri) {
        params.append('redirect_uri', redirectUri);
      }

      console.log(`[WhatsApp] Trying redirect_uri: "${redirectUri}"`);

      const tokenRes = await fetch(
        `https://graph.facebook.com/oauth/access_token?${params.toString()}`
      );
      const tokenData = await tokenRes.json();

      console.log(`[WhatsApp] Result for "${redirectUri}":`, tokenData);

      if (tokenData.access_token) {
        access_token = tokenData.access_token;
        successRedirectUri = redirectUri;
        console.log(`✅ SUCCESS with redirect_uri: "${redirectUri}"`);
        break;
      }
    } catch (err) {
      console.log(`[WhatsApp] Error with "${redirectUri}":`, err.message);
    }
  }

  if (!access_token) {
    return res.status(400).json({
      success: false,
      message: 'Failed to exchange auth code. All redirect_uri attempts failed.'
    });
  }

  try {
    // 2️⃣ Inspect token to find WABA ID
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token` +
      `?input_token=${access_token}` +
      `&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
    );
    const debugData = await debugRes.json();

    console.log('[WhatsApp] Debug response:', JSON.stringify(debugData, null, 2));

    const wabaIds = debugData.data?.granular_scopes?.find(
      (s) => s.scope === 'whatsapp_business_management'
    )?.target_ids || [];

    const wabaId = wabaIds[0] || null;

    // 3️⃣ Get Phone Number ID
    let phoneNumberId = null;
    if (wabaId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/${wabaId}/phone_numbers` +
        `?access_token=${access_token}`
      );
      const phoneData = await phoneRes.json();
      console.log('[WhatsApp] Phone numbers:', phoneData);
      phoneNumberId = phoneData.data?.[0]?.id || null;
    }

    // 4️⃣ Save to tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappWabaId: wabaId,
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: access_token,
      },
    });

    console.log(
      `✅ WhatsApp connected for tenant ${tenantId}` +
      ` — WABA: ${wabaId}, Phone: ${phoneNumberId}` +
      ` — Successful redirect_uri: "${successRedirectUri}"`
    );

    return res.json({
      success: true,
      message: 'WhatsApp Business account connected successfully.',
      wabaId,
      phoneNumberId,
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
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhoneId: phoneNumberId,
        whatsappWabaId: wabaId,
      },
    });

    console.log(`✅ WhatsApp setup saved for tenant ${tenantId} — WABA: ${wabaId}, Phone: ${phoneNumberId}`);

    return res.json({
      success: true,
      message: 'WhatsApp phone number saved successfully.',
      wabaId,
      phoneNumberId,
    });

  } catch (err) {
    console.error('❌ setupWhatsApp error:', err);
    return res.status(500).json({ success: false, message: 'Server error during WhatsApp setup.' });
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

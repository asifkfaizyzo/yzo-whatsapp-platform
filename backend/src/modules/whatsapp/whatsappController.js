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

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    console.error('❌ META_APP_ID or META_APP_SECRET not set in environment.');
    return res.status(500).json({ success: false, message: 'Meta credentials not configured on server.' });
  }

  try {
    // 1️⃣ Exchange auth code → access token
    // Strategy: Try WITHOUT redirect_uri first (recommended for JS SDK popup flow).
    // If Meta returns error 36008, retry WITH the redirect_uri from the frontend.
    const baseParams = {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      code,
    };

    const attempts = [
      { label: 'without redirect_uri', params: { ...baseParams } },
    ];
    // If frontend sent a redirectUri, add it as a fallback attempt
    if (redirectUri) {
      attempts.push({ label: `with redirect_uri=${redirectUri}`, params: { ...baseParams, redirect_uri: redirectUri } });
    }

    let tokenData = null;
    for (const attempt of attempts) {
      const qs = new URLSearchParams(attempt.params);
      const exchangeUrl = `https://graph.facebook.com/v23.0/oauth/access_token?${qs.toString()}`;
      
      console.log(`[WhatsApp] Attempting token exchange ${attempt.label}`);
      console.log(`[WhatsApp]   URL (minus secret): ${exchangeUrl.replace(process.env.META_APP_SECRET, '***')}`);

      const tokenRes = await fetch(exchangeUrl);
      tokenData = await tokenRes.json();

      console.log(`[WhatsApp] Response (${attempt.label}):`, tokenData);

      if (tokenData.access_token) {
        console.log(`[WhatsApp] ✅ Token exchange succeeded ${attempt.label}`);
        break;
      }

      // If it's a redirect_uri error (36008) and we have another attempt, try it
      if (tokenData.error?.error_subcode === 36008 && attempts.indexOf(attempt) < attempts.length - 1) {
        console.log(`[WhatsApp] ⚠️ redirect_uri mismatch, retrying next strategy...`);
        continue;
      }
    }

    if (!tokenData.access_token) {
      console.error('❌ Meta token exchange failed after all attempts:', tokenData);
      return res.status(400).json({
        success: false,
        message: tokenData.error?.message || 'Failed to exchange auth code with Meta.'
      });
    }

    const access_token = tokenData.access_token;

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

    console.log(`✅ WhatsApp connected for tenant ${tenantId} — WABA: ${wabaId}, Phone: ${phoneNumberId}`);

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

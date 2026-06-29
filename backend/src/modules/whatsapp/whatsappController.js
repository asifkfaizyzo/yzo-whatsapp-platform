import prisma from '../../config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// Receives either a short-lived token or auth code from the frontend,
// converts it to a long-lived access token, fetches WABA/Phone IDs,
// and saves them to the tenant.
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeToken = async (req, res) => {
  const { shortLivedToken, code } = req.body;
  const tenantId = req.tenantId;

  if (!shortLivedToken && !code) {
    return res.status(400).json({ 
      success: false, 
      message: 'Either shortLivedToken or auth code is required.' 
    });
  }

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    console.error('❌ META_APP_ID or META_APP_SECRET not set in environment.');
    return res.status(500).json({ success: false, message: 'Meta credentials not configured on server.' });
  }

  try {
    let access_token;

    if (shortLivedToken) {
      // ─── Path A: Extend short-lived token → long-lived token ───
      // This avoids the redirect_uri problem entirely.
      console.log('[WhatsApp] Extending short-lived token to long-lived token...');

      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      });

      const tokenRes = await fetch(
        `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`
      );
      const tokenData = await tokenRes.json();

      console.log('[WhatsApp] Token extension response:', tokenData);

      if (!tokenData.access_token) {
        // If extension fails, try using the short-lived token directly
        console.log('[WhatsApp] Extension failed, using short-lived token directly');
        access_token = shortLivedToken;
      } else {
        access_token = tokenData.access_token;
        console.log('[WhatsApp] ✅ Got long-lived token');
      }
    } else {
      // ─── Path B: Exchange auth code → access token (fallback) ───
      console.log('[WhatsApp] Exchanging auth code for access token...');

      const params = new URLSearchParams({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        code,
      });

      const tokenRes = await fetch(
        `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`
      );
      const tokenData = await tokenRes.json();

      console.log('[WhatsApp] Code exchange response:', tokenData);

      if (!tokenData.access_token) {
        console.error('❌ Meta token exchange failed:', tokenData);
        return res.status(400).json({
          success: false,
          message: tokenData.error?.message || 'Failed to exchange auth code with Meta.'
        });
      }

      access_token = tokenData.access_token;
    }

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

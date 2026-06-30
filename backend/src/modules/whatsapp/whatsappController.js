import prisma from '../../config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// Receives an authorization code from the frontend Embedded Signup,
// exchanges it for an access token, extends to long-lived token,
// fetches WABA/Phone/Business info, and saves to the tenant.
// ─────────────────────────────────────────────────────────────────────────────
export const exchangeToken = async (req, res) => {
  const { code, redirectUri } = req.body;
  const tenantId = req.tenantId;

  if (!code) {
    return res.status(400).json({ 
      success: false, 
      message: 'Authorization code is required.' 
    });
  }

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    console.error('❌ META_APP_ID or META_APP_SECRET not set.');
    return res.status(500).json({ 
      success: false, 
      message: 'Meta credentials not configured.' 
    });
  }

  console.log('──────────────────────────────────────────────────');
  console.log('[WhatsApp] Received redirectUri from frontend:', redirectUri);
  console.log('──────────────────────────────────────────────────');

  // Try multiple redirect_uri values to find the working one
  const candidates = [
    redirectUri,
    '',
    'https://sudoreply.com/dashboard',
    'https://www.sudoreply.com/dashboard',
    'https://sudoreply.com/',
    'https://www.sudoreply.com/',
    'https://sudoreply.com',
    'https://www.sudoreply.com',
  ].filter(c => c !== null && c !== undefined);

  // Remove duplicates
  const uniqueCandidates = [...new Set(candidates)];

  let tokenData = null;
  let workedWith = null;

  try {
    for (const candidate of uniqueCandidates) {
      console.log(`[WhatsApp] Trying redirect_uri: "${candidate}"`);
      
      const params = new URLSearchParams({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: candidate,
        code,
      });

      const r = await fetch(
        `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`
      );
      const data = await r.json();

      if (data.access_token) {
        tokenData = data;
        workedWith = candidate;
        console.log(`✅ SUCCESS with redirect_uri: "${candidate}"`);
        break;
      } else {
        console.log(`❌ Failed with "${candidate}": ${data.error?.message}`);
      }
    }

    if (!tokenData?.access_token) {
      console.error('❌ All redirect_uri candidates failed');
      return res.status(400).json({
        success: false,
        message: 'Failed to exchange auth code with any redirect_uri.'
      });
    }

    console.log(`[WhatsApp] 🎯 Working redirect_uri is: "${workedWith}"`);

    let access_token = tokenData.access_token;

    // ─── Step 2: Long-lived token ───
    console.log('[WhatsApp] Extending to long-lived token...');
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: access_token,
    });

    const longLivedRes = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token?${longLivedParams.toString()}`
    );
    const longLivedData = await longLivedRes.json();

    if (longLivedData.access_token) {
      access_token = longLivedData.access_token;
      console.log('[WhatsApp] ✅ Got long-lived token');
    }

    // ─── Step 3: Get WABA ID ───
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token` +
      `?input_token=${access_token}` +
      `&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
    );
    const debugData = await debugRes.json();
    console.log('[WhatsApp] Debug token:', JSON.stringify(debugData, null, 2));

    const wabaIds = debugData.data?.granular_scopes?.find(
      (s) => s.scope === 'whatsapp_business_management'
    )?.target_ids || [];

    const wabaId = wabaIds[0] || null;

    // ─── Step 4: Get phone number ───
    let phoneNumberId = null;
    let displayPhoneNumber = null;
    let verifiedName = null;

    if (wabaId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?access_token=${access_token}`
      );
      const phoneData = await phoneRes.json();
      console.log('[WhatsApp] Phone numbers:', JSON.stringify(phoneData, null, 2));
      
      const firstPhone = phoneData.data?.[0];
      phoneNumberId = firstPhone?.id || null;
      displayPhoneNumber = firstPhone?.display_phone_number || null;
      verifiedName = firstPhone?.verified_name || null;
    }

    // ─── Step 5: Save to DB ───
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappWabaId: wabaId,
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: access_token,
      },
    });

    console.log(`✅ WhatsApp connected for tenant ${tenantId}`);

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

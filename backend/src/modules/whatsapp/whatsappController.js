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

  // if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
  //   console.error('❌ META_APP_ID or META_APP_SECRET not set in environment.');
  //   return res.status(500).json({ success: false, message: 'Meta credentials not configured on server.' });
  // }

  // // Fallback to env var if frontend didn't send it, but frontend should send it.
  // const finalRedirectUri = redirectUri || process.env.META_REDIRECT_URI;
  
  // console.log('──────────────────────────────────────────────────');
  // console.log('[WhatsApp] Redirect URI received from frontend:', redirectUri);
  // console.log('[WhatsApp] Final Redirect URI used for exchange:', finalRedirectUri);
  // console.log('──────────────────────────────────────────────────');

  // if (!finalRedirectUri) {
  //   console.error('❌ No redirect_uri provided from frontend or environment.');
  //   return res.status(500).json({ success: false, message: 'Redirect URI missing.' });
  // }

  try {
    // ─── Step 1: Exchange authorization code → short-lived access token ───
    console.log('[WhatsApp] Step 1: Exchanging auth code for access token...');
    
    const exchangeParams = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: '',
      code,
    });

    console.log('[WhatsApp] Exchange params:', {
      client_id: process.env.META_APP_ID,
      redirect_uri: '',
      code: code.substring(0, 20) + '...',
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token?${exchangeParams.toString()}`
    );
    const tokenData = await tokenRes.json();

    console.log('[WhatsApp] Code exchange response:', JSON.stringify(tokenData, null, 2));

    if (!tokenData.access_token) {
      console.error('❌ Meta code exchange failed:', tokenData);
      return res.status(400).json({
        success: false,
        message: tokenData.error?.message || 'Failed to exchange auth code with Meta.'
      });
    }

    let access_token = tokenData.access_token;
    console.log('[WhatsApp] ✅ Got short-lived access token');

    // ─── Step 2: Exchange short-lived token → long-lived token (60 days) ───
    console.log('[WhatsApp] Step 2: Extending to long-lived token...');

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

    console.log('[WhatsApp] Long-lived token response:', {
      has_token: !!longLivedData.access_token,
      token_type: longLivedData.token_type,
      expires_in: longLivedData.expires_in,
    });

    if (longLivedData.access_token) {
      access_token = longLivedData.access_token;
      console.log('[WhatsApp] ✅ Got long-lived token (expires in', longLivedData.expires_in, 'seconds)');
    } else {
      console.warn('[WhatsApp] ⚠️ Long-lived token exchange failed, continuing with short-lived token');
    }

    // ─── Step 3: Inspect token to find WABA ID ───
    console.log('[WhatsApp] Step 3: Inspecting token for WABA ID...');

    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token` +
      `?input_token=${access_token}` +
      `&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
    );
    const debugData = await debugRes.json();

    console.log('[WhatsApp] Debug token response:', JSON.stringify(debugData, null, 2));

    const wabaIds = debugData.data?.granular_scopes?.find(
      (s) => s.scope === 'whatsapp_business_management'
    )?.target_ids || [];

    const wabaId = wabaIds[0] || null;
    console.log('[WhatsApp] WABA ID:', wabaId);

    // ─── Step 4: Get Business ID ───
    console.log('[WhatsApp] Step 4: Fetching business info...');
    let businessId = null;

    try {
      const bizRes = await fetch(
        `https://graph.facebook.com/v23.0/me/businesses?access_token=${access_token}`
      );
      const bizData = await bizRes.json();
      console.log('[WhatsApp] Business info:', JSON.stringify(bizData, null, 2));
      businessId = bizData.data?.[0]?.id || null;
    } catch (bizErr) {
      console.warn('[WhatsApp] ⚠️ Could not fetch business info:', bizErr.message);
    }

    // ─── Step 5: Get Phone Number details ───
    console.log('[WhatsApp] Step 5: Fetching phone numbers...');
    let phoneNumberId = null;
    let displayPhoneNumber = null;
    let verifiedName = null;

    if (wabaId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v23.0/${wabaId}/phone_numbers` +
        `?access_token=${access_token}`
      );
      const phoneData = await phoneRes.json();
      console.log('[WhatsApp] Phone numbers response:', JSON.stringify(phoneData, null, 2));
      
      const firstPhone = phoneData.data?.[0];
      phoneNumberId = firstPhone?.id || null;
      displayPhoneNumber = firstPhone?.display_phone_number || null;
      verifiedName = firstPhone?.verified_name || null;
    }

    // ─── Step 6: Save to tenant ───
    console.log('[WhatsApp] Step 6: Saving to database...');

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappWabaId: wabaId,
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: access_token,
      },
    });

    console.log(`✅ WhatsApp connected for tenant ${tenantId}`);
    console.log(`   WABA: ${wabaId}`);
    console.log(`   Phone: ${phoneNumberId}`);
    console.log(`   Display: ${displayPhoneNumber}`);
    console.log(`   Business: ${businessId}`);
    console.log(`   Verified Name: ${verifiedName}`);

    return res.json({
      success: true,
      message: 'WhatsApp Business account connected successfully.',
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
      businessId,
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

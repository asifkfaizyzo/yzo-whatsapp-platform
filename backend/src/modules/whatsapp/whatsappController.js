import prisma from '../../config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/exchange-token
// Receives an authorization code from the frontend Embedded Signup,
// exchanges it for an access token, extends to long-lived token,
// fetches WABA/Phone/Business info, and saves to the tenant.
// ─────────────────────────────────────────────────────────────────────────────
// export const exchangeToken = async (req, res) => {
//   const { code } = req.body;
//   const tenantId = req.tenantId;

//   if (!code) {
//     return res.status(400).json({ 
//       success: false, 
//       message: 'Authorization code is required.' 
//     });
//   }

//   if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
//     console.error('❌ META_APP_ID or META_APP_SECRET not set.');
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Meta credentials not configured.' 
//     });
//   }

//   console.log('──────────────────────────────────────────────────');
//   console.log('[WhatsApp] Exchanging Embedded Signup code for token...');
//   console.log('──────────────────────────────────────────────────');

//   try {
//     // ─── Step 1: Exchange code for access token (NO redirect_uri) ───
//     const exchangeParams = new URLSearchParams({
//       client_id: process.env.META_APP_ID,
//       client_secret: process.env.META_APP_SECRET,
//       code,
//     });

//     console.log('[WhatsApp] Making token exchange request...');

//     const tokenRes = await fetch(
//       `https://graph.facebook.com/v25.0/oauth/access_token?${exchangeParams.toString()}`
//     );
//     const tokenData = await tokenRes.json();

//     console.log('[WhatsApp] Token exchange response:', JSON.stringify(tokenData, null, 2));

//     if (!tokenData.access_token) {
//       console.error('❌ Token exchange failed:', tokenData);
//       return res.status(400).json({
//         success: false,
//         message: tokenData.error?.message || 'Failed to exchange code with Meta.'
//       });
//     }

//     let access_token = tokenData.access_token;
//     console.log('[WhatsApp] ✅ Got access token');

//     // ─── Step 2: Long-lived token ───
//     console.log('[WhatsApp] Extending to long-lived token...');
//     const longLivedParams = new URLSearchParams({
//       grant_type: 'fb_exchange_token',
//       client_id: process.env.META_APP_ID,
//       client_secret: process.env.META_APP_SECRET,
//       fb_exchange_token: access_token,
//     });

//     const longLivedRes = await fetch(
//       `https://graph.facebook.com/v25.0/oauth/access_token?${longLivedParams.toString()}`
//     );
//     const longLivedData = await longLivedRes.json();

//     if (longLivedData.access_token) {
//       access_token = longLivedData.access_token;
//       console.log('[WhatsApp] ✅ Got long-lived token');
//     }

//     // ─── Step 3: Get WABA ID ───
//     const debugRes = await fetch(
//       `https://graph.facebook.com/debug_token` +
//       `?input_token=${access_token}` +
//       `&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
//     );
//     const debugData = await debugRes.json();
//     console.log('[WhatsApp] Debug token:', JSON.stringify(debugData, null, 2));

//     const wabaIds = debugData.data?.granular_scopes?.find(
//       (s) => s.scope === 'whatsapp_business_management'
//     )?.target_ids || [];

//     const wabaId = wabaIds[0] || null;

//     // ─── Step 4: Get phone number ───
//     let phoneNumberId = null;
//     let displayPhoneNumber = null;
//     let verifiedName = null;

//     if (wabaId) {
//       const phoneRes = await fetch(
//         `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?access_token=${access_token}`
//       );
//       const phoneData = await phoneRes.json();
//       console.log('[WhatsApp] Phone numbers:', JSON.stringify(phoneData, null, 2));
      
//       const firstPhone = phoneData.data?.[0];
//       phoneNumberId = firstPhone?.id || null;
//       displayPhoneNumber = firstPhone?.display_phone_number || null;
//       verifiedName = firstPhone?.verified_name || null;
//     }

//     // ─── Step 5: Save to DB ───
//     await prisma.tenant.update({
//       where: { id: tenantId },
//       data: {
//         whatsappWabaId: wabaId,
//         whatsappPhoneId: phoneNumberId,
//         whatsappAccessToken: access_token,
//       },
//     });

//     console.log(`✅ WhatsApp connected for tenant ${tenantId}`);

//     return res.json({
//       success: true,
//       message: 'WhatsApp Business account connected successfully.',
//       wabaId,
//       phoneNumberId,
//       displayPhoneNumber,
//       verifiedName,
//     });

//   } catch (err) {
//     console.error('❌ exchangeToken error:', err);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Server error during token exchange.' 
//     });
//   }
// };

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api2/whatsapp/wabas-from-token
// Fetches WABAs using the user's access token from FB.login
// ─────────────────────────────────────────────────────────────────────────────
export const getWabasFromToken = async (req, res) => {
  try {
    const { accessToken } = req.body;
    const tenantId = req.tenantId;

    if (!accessToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Access token is required.' 
      });
    }

    console.log('[WhatsApp] Fetching WABAs with user token for tenant:', tenantId);

    const response = await fetch(
      `https://graph.facebook.com/v25.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,verified_name,display_phone_number,code_verification_status,quality_rating,platform_type}}&access_token=${accessToken}`
    );

    const data = await response.json();
    console.log('[WhatsApp] Businesses response:', JSON.stringify(data, null, 2));

    if (data.error) {
      return res.status(400).json({
        success: false,
        message: data.error.message,
      });
    }

    const wabas = [];

    if (data.data && data.data.length > 0) {
      for (const business of data.data) {
        if (business.owned_whatsapp_business_accounts?.data) {
          for (const waba of business.owned_whatsapp_business_accounts.data) {
            const phones = waba.phone_numbers?.data || [];
            wabas.push({
              id: waba.id,
              name: waba.name,
              phones: phones.map((p) => ({
                id: p.id,
                verified_name: p.verified_name,
                display_phone_number: p.display_phone_number,
                code_verification_status: p.code_verification_status,
                quality_rating: p.quality_rating,
                platform_type: p.platform_type,
              })),
            });
          }
        }
      }
    }

    console.log('[WhatsApp] Extracted WABAs from user token:', JSON.stringify(wabas, null, 2));

    return res.json({
      success: true,
      wabas,
    });
  } catch (err) {
    console.error('❌ Error in getWabasFromToken:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching WABAs',
    });
  }
};


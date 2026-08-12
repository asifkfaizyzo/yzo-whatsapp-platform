// src/modules/whatsapp/whatsappService.js

import prisma  from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';

// ─────────────────────────────────────────────────────────────
// SEND LOCATION  (Agent/Tenant → Contact via WhatsApp)
// ─────────────────────────────────────────────────────────────

/**
 * Sends a location pin to a WhatsApp contact
 * and saves the message to the database.
 *
 * @param {Object} params
 * @param {string} params.tenantId       - Tenant making the request
 * @param {string} params.to             - Recipient phone (digits only, no +)
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} [params.name]         - Optional place name
 * @param {string} [params.address]      - Optional address text
 * @param {string} [params.conversationId]
 * @param {string} [params.senderId]     - tenant.id or user.id
 * @param {string} [params.senderType]   - 'TENANT' | 'USER'
 *
 * @returns {Promise<{ waMessageId: string|null, message: Object }>}
 */
export const sendLocationService = async ({
  tenantId,
  to,
  latitude,
  longitude,
  name,
  address,
  conversationId,
  senderId,
  senderType,
}) => {

  // ── Step 1: Get tenant WhatsApp credentials ───────────────
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      whatsappPhoneId:     true,
      whatsappAccessToken: true,
    },
  });

  // ── Step 2: Send to WhatsApp Cloud API ────────────────────
  let waMessageId = null;

  // ── MOCK MODE: skip real API call ─────────────────────────
  if (process.env.MOCK_WHATSAPP === 'true') {
    console.log('⚠️  MOCK_WHATSAPP=true → skipping real WhatsApp API call');
    console.log('📍 Mock location send:', { to, latitude, longitude, name, address });
    waMessageId = `mock_wamid_${Date.now()}`;

  } else {
    // ── REAL MODE: check credentials ────────────────────────
    if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
      const err = new Error('WhatsApp is not configured for this account');
      err.statusCode = 400;
      throw err;
    }

    // ── Build payload ────────────────────────────────────────
    const waPayload = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type:              'location',
      location: {
        latitude:  parseFloat(latitude),
        longitude: parseFloat(longitude),
        ...(name    && { name }),
        ...(address && { address }),
      },
    };

    try {
      const accessToken = decrypt(tenant.whatsappAccessToken);
      const phoneId     = tenant.whatsappPhoneId;

      const response = await fetch(
        `https://graph.facebook.com/v23.0/${phoneId}/messages`,
        {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify(waPayload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('⚠️ WhatsApp location send error:', errorData);
      } else {
        const responseData = await response.json();
        waMessageId = responseData?.messages?.[0]?.id || null;
        console.log('✅ Location sent via WhatsApp, wamid:', waMessageId);
      }

    } catch (waError) {
      console.error('⚠️ WhatsApp location send failed:', waError.message);
    }
  }

  // ── Step 3: Get or verify conversation ───────────────────
  let savedMessage = null;

  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (conversation.tenantId !== tenantId) {
      const err = new Error('Unauthorized: Conversation does not belong to this tenant');
      err.statusCode = 403;
      throw err;
    }

    // ── Step 4: Save message to DB ───────────────────────────
    savedMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId:     senderId   || null,
        senderType:   senderType || 'TENANT',
        direction:    'OUTBOUND',
        type:         'LOCATION',
        status:       'sent',
        isRead:       false,
        locLatitude:  parseFloat(latitude),
        locLongitude: parseFloat(longitude),
        locName:      name    || null,
        locAddress:   address || null,
        text:         null,
        mediaUrl:     null,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data:  { lastMessageAt: new Date() },
    });

    console.log(`✅ Location message saved to DB: ${savedMessage.id}`);
  }

  return {
    waMessageId,
    message: savedMessage,
  };
};
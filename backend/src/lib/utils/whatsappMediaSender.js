// src/lib/utils/whatsappMediaSender.js

import fs from 'fs';
import { decrypt } from '../crypto.js';

/**
 * Uploads media to Meta and sends it via WhatsApp
 * Reusable by: messageService, flowEngineService, broadcastService
 */
export const sendWhatsAppMedia = async ({
  tenant,
  contactPhone,
  file,           // { path, originalname, mimetype, size }
  caption,
  mediaType,      // 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'
}) => {
  const accessToken = decrypt(tenant.whatsappAccessToken);
  const phoneId     = tenant.whatsappPhoneId;
  const cleanPhone  = contactPhone.replace('+', '');

  // ── Step 1: Upload media to Meta ──
  const fileBuffer = fs.readFileSync(file.path);

  let uploadMimeType = file.mimetype || 'application/octet-stream';
  const metaAllowedTypes = [
    'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg', 'audio/opus',
    'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/3gpp',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (!metaAllowedTypes.includes(uploadMimeType)) {
    if (uploadMimeType.startsWith('audio/'))      uploadMimeType = 'audio/ogg';
    else if (uploadMimeType.startsWith('image/')) uploadMimeType = 'image/jpeg';
    else if (uploadMimeType.startsWith('video/')) uploadMimeType = 'video/mp4';
    else                                          uploadMimeType = 'application/pdf';
  }

  const blob = new Blob([fileBuffer], { type: uploadMimeType });

  const formData = new globalThis.FormData();
  formData.append('file', blob, file.originalname);
  formData.append('messaging_product', 'whatsapp');

  const uploadRes = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/media`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body:    formData,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    console.error('❌ Meta media upload error:', err);
    throw new Error(`Media upload failed: ${err.error?.message || JSON.stringify(err)}`);
  }

  const { id: mediaId } = await uploadRes.json();

  // ── Step 2: Send message with media ID ──
  const typeMap = {
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    FILE:  'document',
  };

  let waType = typeMap[mediaType] || 'document';

  const supportedAudioMimeTypes = ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'];
  if (waType === 'audio' && file.mimetype && !supportedAudioMimeTypes.some(m => file.mimetype.includes(m))) {
    waType = 'document';
  }

  const mediaPayload = { id: mediaId };
  if (waType === 'document' && file.originalname) {
    mediaPayload.filename = file.originalname;
  }
  if ((waType === 'image' || waType === 'video' || waType === 'document') && caption) {
    mediaPayload.caption = caption;
  }

  const sendRes = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to:                cleanPhone,
        type:              waType,
        [waType]:          mediaPayload,
      }),
    }
  );

  if (!sendRes.ok) {
    const err = await sendRes.json();
    throw new Error(`WhatsApp send failed: ${err.error?.message}`);
  }

  const result = await sendRes.json();
  return {
    waMessageId: result?.messages?.[0]?.id || null,
    mediaId,
  };
};
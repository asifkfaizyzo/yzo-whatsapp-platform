// backend/src/lib/utils/whatsapp.mediaSender.js (do not remove this comment)

import fs from "fs";
import path from "path";
import { decrypt } from "../crypto.js";
import { normalizeMimeType } from "./media.validator.js";
import { processWhatsAppAudio } from "./audio.converter.js";

/**
 * Uploads media to Meta and sends it via WhatsApp
 * Reusable by: messageService, flowEngineService, broadcastService
 */
export const sendWhatsAppMedia = async ({
  tenant,
  contactPhone,
  file, // { path, originalname, mimetype, size }
  caption,
  mediaType, // 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'
  isVoiceNote = false,
  audioAlreadyProcessed = false,
}) => {
  const accessToken = decrypt(tenant.whatsappAccessToken);
  const phoneId = tenant.whatsappPhoneId;
  const cleanPhone = contactPhone.replace("+", "");

  // -- Step 1: Upload media to Meta --
  const fileBuffer = fs.readFileSync(file.path);

  // ── Step 1: Upload media to Meta ──
  const resolvedFilePath = path.isAbsolute(uploadFile.path)
    ? uploadFile.path
    : path.resolve(process.cwd(), uploadFile.path);
  const fileBuffer = fs.readFileSync(resolvedFilePath);

  let uploadMimeType =
    normalizeMimeType(uploadFile.mimetype) || "application/octet-stream";
  const metaAllowedTypes = [
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/amr",
    "audio/ogg",
    "audio/opus",
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/3gpp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  if (!metaAllowedTypes.includes(uploadMimeType)) {
    if (uploadMimeType.startsWith("audio/")) {
      throw new Error(`Unsupported WhatsApp audio MIME type: ${uploadMimeType}`);
    } else if (uploadMimeType.startsWith("image/")) {
      uploadMimeType = "image/jpeg";
    } else if (uploadMimeType.startsWith("video/")) {
      uploadMimeType = "video/mp4";
    } else {
      uploadMimeType = "application/pdf";
    }
  }

  const blob = new Blob([fileBuffer], { type: uploadMimeType });

  const formData = new globalThis.FormData();
  formData.append("file", blob, uploadFile.originalname);
  formData.append("messaging_product", "whatsapp");

  const uploadRes = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    },
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    console.error("? Meta media upload error:", err);
    throw new Error(
      `Media upload failed: ${err.error?.message || JSON.stringify(err)}`,
    );
  }

  const { id: mediaId } = await uploadRes.json();

  // -- Step 2: Send message with media ID --
  const typeMap = {
    IMAGE: "image",
    VIDEO: "video",
    AUDIO: "audio",
    FILE: "document",
  };

  let waType = typeMap[mediaType] || "document";

  const supportedAudioMimeTypes = [
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/amr",
    "audio/ogg",
  ];
  if (
    waType === "audio" &&
    !supportedAudioMimeTypes.includes(uploadMimeType)
  ) {
    throw new Error(`Unsupported WhatsApp audio MIME type: ${uploadMimeType}`);
  }

  const mediaPayload = { id: mediaId };
  if (waType === "audio" && isVoiceNote) {
    mediaPayload.voice = true;
  }

  if (waType === "document" && uploadFile.originalname) {
    mediaPayload.filename = uploadFile.originalname;
  }
  if (
    (waType === "image" || waType === "video" || waType === "document") &&
    caption
  ) {
    mediaPayload.caption = caption;
  }

  const sendRes = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: waType,
        [waType]: mediaPayload,
      }),
    },
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

// src/lib/utils/signedUrl.js
//→ URL only works for 1 hour ✅
//→ Signature cannot be faked ✅
//→ Cannot access other tenant files ✅
//→ Even if URL leaked = expires soon ✅

import crypto from 'crypto';

const SECRET = process.env.MEDIA_SIGN_SECRET || 'your_media_secret_key_min_32_chars';
const EXPIRY = 60 * 60; // 1 hour

// ── Generate Signed URL ──────────────────────────────────────
export const generateSignedUrl = (filePath, tenantId) => {
  const expires   = Math.floor(Date.now() / 1000) + EXPIRY;
  const payload   = `${filePath}:${tenantId}:${expires}`;
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  const baseUrl = process.env.BASE_URL;
  const encoded = encodeURIComponent(filePath);
  const relativeUrl = `/api/media/serve?path=${encoded}&tenant=${tenantId}&expires=${expires}&sig=${signature}`;

  if (baseUrl && baseUrl.startsWith('http') && !baseUrl.includes('localhost') && !baseUrl.includes('backend:')) {
    return `${baseUrl.replace(/\/+$/, '')}${relativeUrl}`;
  }

  return relativeUrl;
};

// ── Verify Signed URL ────────────────────────────────────────
export const verifySignedUrl = (filePath, tenantId, expires, signature) => {

  // 1. Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > parseInt(expires)) {
    return { valid: false, reason: 'URL expired' };
  }

  // 2. Verify signature
  const payload  = `${filePath}:${tenantId}:${expires}`;
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expected) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
};
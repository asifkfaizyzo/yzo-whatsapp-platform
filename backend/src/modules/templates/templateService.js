import { decrypt } from '../../lib/crypto.js';
import fs from 'fs';

const META_API_VERSION = 'v23.0';

// ─────────────────────────────────────────────────────────────
// 1. Fetch templates catalog from Meta Business Account (WABA)
// ─────────────────────────────────────────────────────────────
export const fetchMetaTemplates = async (tenant) => {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${tenant.whatsappWabaId}/message_templates?limit=100`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${decrypt(tenant.whatsappAccessToken)}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch templates from Meta');
  }

  const payload = await response.json();
  return payload.data || [];
};

// ─────────────────────────────────────────────────────────────
// 2. Submit a new message template to Meta review pipeline
// ─────────────────────────────────────────────────────────────
export const submitMetaTemplate = async (tenant, { name, category, language, components }) => {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${tenant.whatsappWabaId}/message_templates`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${decrypt(tenant.whatsappAccessToken)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, category, language, components })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Meta template submission failed');
  }

  return response.json();
};

// ─────────────────────────────────────────────────────────────
// 3. Delete a template from WABA
// ─────────────────────────────────────────────────────────────
export const deleteMetaTemplate = async (tenant, templateName) => {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${tenant.whatsappWabaId}/message_templates?name=${templateName}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${decrypt(tenant.whatsappAccessToken)}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Meta template deletion failed');
  }

  return response.json();
};

// ─────────────────────────────────────────────────────────────
// 4. Upload media to Meta using Resumable Upload API
//    Returns: mediaHandle string (used in example.header_handle)
// ─────────────────────────────────────────────────────────────
export const uploadMediaToMeta = async (tenant, filePath, mimeType) => {
  const accessToken = decrypt(tenant.whatsappAccessToken);
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  // Step 1: Create an upload session
  const sessionUrl = `https://graph.facebook.com/${META_API_VERSION}/app/uploads`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_length: fileSize,
      file_type: mimeType,
    }),
  });

  if (!sessionRes.ok) {
    const err = await sessionRes.json();
    const error = new Error(err.error?.message || 'Failed to create Meta upload session');
    error.code = 'META_UPLOAD_SESSION_FAILED';
    throw error;
  }

  const { id: uploadSessionId } = await sessionRes.json();

  // Step 2: Upload the file binary
  const uploadUrl = `https://graph.facebook.com/${META_API_VERSION}/${uploadSessionId}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${accessToken}`,
      'Content-Type': mimeType,
      'Content-Length': String(fileSize),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    const error = new Error(err.error?.message || 'Failed to transfer file to Meta');
    error.code = 'META_UPLOAD_TRANSFER_FAILED';
    throw error;
  }

  const result = await uploadRes.json();
  // Meta returns { h: "<handle>" }
  const handle = result.h;
  if (!handle) {
    const error = new Error('Meta upload did not return a media handle');
    error.code = 'META_UPLOAD_NO_HANDLE';
    throw error;
  }

  return handle;
};

// ─────────────────────────────────────────────────────────────
// 5. Build the full Meta components array
// ─────────────────────────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {'NONE'|'TEXT'|'IMAGE'|'VIDEO'|'DOCUMENT'|'LOCATION'} opts.headerType
 * @param {string|null} opts.headerText           – TEXT header content
 * @param {string|null} opts.headerHandle         – Meta media handle for IMAGE/VIDEO/DOCUMENT
 * @param {string}      opts.bodyText             – body text (required)
 * @param {string[]}    opts.bodyExampleValues    – sample values for {{n}} placeholders
 * @param {string|null} opts.footerText
 * @param {Array}       opts.buttons              – array of button definition objects
 * @returns {{ components: Array, validationError: string|null }}
 */
export const buildTemplateComponents = ({
  headerType,
  headerText,
  headerHandle,
  bodyText,
  bodyExampleValues = [],
  footerText,
  buttons = [],
}) => {
  const components = [];

  // ── HEADER component ──────────────────────────────────────
  if (headerType === 'TEXT') {
    const headerComp = { type: 'HEADER', format: 'TEXT', text: headerText };
    // If header contains {{1}}, supply an example
    if (headerText && /\{\{1\}\}/.test(headerText)) {
      headerComp.example = { header_text: ['sample_header'] };
    }
    components.push(headerComp);

  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    components.push({
      type: 'HEADER',
      format: headerType,
      example: { header_handle: [headerHandle] },
    });

  } else if (headerType === 'LOCATION') {
    // Meta native LOCATION header — no data in the template itself
    components.push({ type: 'HEADER', format: 'LOCATION' });
  }
  // NONE → no HEADER component

  // ── BODY component ────────────────────────────────────────
  const bodyComp = { type: 'BODY', text: bodyText };
  const placeholders = bodyText.match(/\{\{(\d+)\}\}/g);
  if (placeholders) {
    const count = new Set(placeholders).size;
    const samples = bodyExampleValues.length >= count
      ? bodyExampleValues.slice(0, count).map(String)
      : Array.from({ length: count }, (_, i) => bodyExampleValues[i] ?? `sample_${i + 1}`);
    bodyComp.example = { body_text: [samples] };
  }
  components.push(bodyComp);

  // ── FOOTER component ──────────────────────────────────────
  if (footerText && footerText.trim()) {
    components.push({ type: 'FOOTER', text: footerText.trim() });
  }

  // ── BUTTONS component ─────────────────────────────────────
  if (buttons && buttons.length > 0) {
    const validationError = validateButtons(buttons);
    if (validationError) {
      return { components: null, validationError };
    }

    const buttonComps = buttons.map((btn) => {
      if (btn.type === 'QUICK_REPLY') {
        return { type: 'QUICK_REPLY', text: btn.text };
      }
      if (btn.type === 'URL') {
        const urlBtn = { type: 'URL', text: btn.text, url: btn.url };
        if (btn.url && /\{\{1\}\}/.test(btn.url)) {
          urlBtn.example = ['https://example.com/sample'];
        }
        return urlBtn;
      }
      if (btn.type === 'PHONE_NUMBER') {
        return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phoneNumber };
      }
      return null;
    }).filter(Boolean);

    components.push({ type: 'BUTTONS', buttons: buttonComps });
  }

  return { components, validationError: null };
};

// ─────────────────────────────────────────────────────────────
// 6. Validate button definitions (Meta rules)
// ─────────────────────────────────────────────────────────────
function validateButtons(buttons) {
  if (buttons.length > 10) {
    return 'Maximum 10 buttons are allowed per template.';
  }

  const urlCount = buttons.filter(b => b.type === 'URL').length;
  if (urlCount > 2) {
    return 'Maximum 2 URL buttons are allowed per template.';
  }

  const phoneCount = buttons.filter(b => b.type === 'PHONE_NUMBER').length;
  if (phoneCount > 1) {
    return 'Maximum 1 phone number button is allowed per template.';
  }

  for (const btn of buttons) {
    if (!btn.text || btn.text.trim().length === 0) {
      return 'All buttons must have button text.';
    }
    if (btn.text.length > 25) {
      return `Button text "${btn.text}" exceeds 25 character limit.`;
    }
    if (btn.type === 'URL') {
      if (!btn.url || btn.url.trim().length === 0) {
        return 'URL buttons must have a URL.';
      }
      if (btn.url.length > 2000) {
        return 'Button URL exceeds 2000 character limit.';
      }
    }
    if (btn.type === 'PHONE_NUMBER') {
      if (!btn.phoneNumber || btn.phoneNumber.trim().length === 0) {
        return 'Phone number buttons must have a phone number.';
      }
    }
  }

  // Validate QUICK_REPLY grouping — they must not be interleaved with other types
  const types = buttons.map(b => b.type === 'QUICK_REPLY' ? 'QR' : 'OTHER');
  const firstQR   = types.indexOf('QR');
  const lastQR    = types.lastIndexOf('QR');
  const firstOther = types.indexOf('OTHER');
  const lastOther  = types.lastIndexOf('OTHER');

  if (firstQR !== -1 && firstOther !== -1) {
    // interleaving check: if QR and OTHER both exist, QRs must be contiguous
    if (lastOther > firstQR && firstOther < lastQR) {
      return 'Quick Reply buttons cannot be mixed with other button types in an interleaved order. Group all Quick Reply buttons together.';
    }
  }

  return null; // valid
}

// ─────────────────────────────────────────────────────────────
// 7. Infer TemplateHeaderType from a Meta components array
//    Used by syncTemplates to derive the typed enum value
// ─────────────────────────────────────────────────────────────
export const inferHeaderTypeFromComponents = (components) => {
  if (!Array.isArray(components)) return 'NONE';

  const headerComp = components.find(c => c.type === 'HEADER');
  if (!headerComp) return 'NONE';

  const format = (headerComp.format || '').toUpperCase();

  switch (format) {
    case 'TEXT':     return 'TEXT';
    case 'IMAGE':    return 'IMAGE';
    case 'VIDEO':    return 'VIDEO';
    case 'DOCUMENT': return 'DOCUMENT';
    case 'LOCATION': return 'LOCATION';
    default:         return 'NONE';
  }
};
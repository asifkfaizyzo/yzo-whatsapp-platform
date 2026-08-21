// src/lib/metaErrorCodes.js

/**
 * Meta WhatsApp Cloud API Error Code Dictionary
 * Maps raw error codes from Meta Cloud API & Webhooks to structured, human-friendly diagnostics.
 */

export const META_ERROR_CODES = {
  // ── 1. Invalid Recipient / Number Issues (Non-recoverable) ──
  131026: {
    category: 'INVALID_NUMBER',
    title: 'Receiver is not registered on WhatsApp',
    description: 'The recipient phone number does not have an active WhatsApp account.',
    action: 'Verify the phone number format or remove this contact from your marketing lists.',
    isRecoverable: false,
  },
  131051: {
    category: 'INVALID_NUMBER',
    title: 'Unsupported phone number type',
    description: 'The destination phone number type is unsupported (e.g. landline or VoIP number without WhatsApp capability).',
    action: 'Check with the customer to obtain their direct WhatsApp mobile number.',
    isRecoverable: false,
  },
  131052: {
    category: 'INVALID_NUMBER',
    title: 'Media download failure on recipient device',
    description: 'The recipient device was unable to download the media asset.',
    action: 'Ensure media file size is under Meta limits (image < 5MB, video < 16MB, document < 100MB).',
    isRecoverable: true,
  },
  131053: {
    category: 'INVALID_NUMBER',
    title: 'Media upload error',
    description: 'The media attached could not be processed by Meta servers.',
    action: 'Re-upload the media header asset in template settings and try again.',
    isRecoverable: true,
  },

  // ── 2. 24-Hour Messaging Policy & Conversation Window ──
  131047: {
    category: 'POLICY_VIOLATION',
    title: '24-hour messaging window closed',
    description: 'More than 24 hours have elapsed since the user last contacted you. Free-form messages cannot be sent.',
    action: 'Send an approved Meta template message (Marketing, Utility, or Authentication) to initiate a new session.',
    isRecoverable: false,
  },
  131042: {
    category: 'POLICY_VIOLATION',
    title: 'Business account eligibility / Payment issue',
    description: 'Your WhatsApp Business Account has payment issues or temporary policy restrictions.',
    action: 'Check Meta Business Manager payment methods and account quality status.',
    isRecoverable: false,
  },

  // ── 3. Throughput & Messaging Tier Limits ──
  130429: {
    category: 'RATE_LIMIT',
    title: 'Rate limit or 24-hour tier quota exceeded',
    description: 'You have exceeded your per-second throughput limit or 24-hour unique recipient tier limit (e.g. Tier 1K).',
    action: 'The system will automatically back off and retry. Consider requesting a messaging limit tier increase in Meta Business Manager.',
    isRecoverable: true,
  },
  131056: {
    category: 'RATE_LIMIT',
    title: 'Temporary service overload at Meta',
    description: 'Meta Cloud API servers are experiencing temporary high load.',
    action: 'This is a transient Meta outage. The system will retry with exponential backoff.',
    isRecoverable: true,
  },

  // ── 4. Template & Parameter Mismatches ──
  132000: {
    category: 'TEMPLATE_ERROR',
    title: 'Template parameter count mismatch',
    description: 'The number of variables provided did not match the template component definition in Meta.',
    action: 'Review the template dynamic parameters in the broadcast setup and ensure all {{1}}, {{2}} placeholders are filled.',
    isRecoverable: false,
  },
  132001: {
    category: 'TEMPLATE_ERROR',
    title: 'Template does not exist or not approved',
    description: 'The template name or language code is not approved in your Meta Business Account.',
    action: 'Ensure the template is in APPROVED status in Meta WhatsApp Manager before broadcasting.',
    isRecoverable: false,
  },
  132005: {
    category: 'TEMPLATE_ERROR',
    title: 'Template translated text too long',
    description: 'The text parameter exceeded Meta character limit for this template component.',
    action: 'Shorten dynamic variable values (headers max 60 chars, body variables max 1024 chars).',
    isRecoverable: false,
  },
  132012: {
    category: 'TEMPLATE_ERROR',
    title: 'Template header media missing or corrupt',
    description: 'The header media handle or URL could not be resolved.',
    action: 'Check that your header media image or document file exists and is accessible.',
    isRecoverable: true,
  },

  // ── 5. Authentication & Permissions ──
  190: {
    category: 'AUTH_ERROR',
    title: 'Access token expired or invalidated',
    description: 'Your Meta System User access token has expired or permissions were revoked.',
    action: 'Generate a new Permanent System User Access Token in Meta Business Manager and update in Settings.',
    isRecoverable: false,
  },
  100: {
    category: 'AUTH_ERROR',
    title: 'Invalid parameter or Phone ID mismatch',
    description: 'The WhatsApp Phone ID or WABA ID configured does not match the token permissions.',
    action: 'Verify your Phone Number ID and WABA ID in Settings -> WhatsApp Connect.',
    isRecoverable: false,
  },
};

/**
 * Resolves a Meta error code and raw message to a structured diagnostic object.
 * @param {string|number} code 
 * @param {string} rawMessage 
 * @returns {object}
 */
export const parseMetaError = (code, rawMessage = '') => {
  let numericCode = parseInt(code, 10);
  if (isNaN(numericCode) && rawMessage) {
    const match = String(rawMessage).match(/#?(\d{4,7})/);
    if (match) {
      numericCode = parseInt(match[1], 10);
    }
  }

  const matched = META_ERROR_CODES[numericCode];

  if (matched) {
    return {
      errorCode: String(numericCode),
      category: matched.category,
      title: matched.title,
      description: matched.description,
      action: matched.action,
      isRecoverable: matched.isRecoverable,
      rawMessage: rawMessage || matched.title,
    };
  }

  // Fallback for unexpected or generic errors
  const isNetworkOrTimeout = /timeout|network|econnrefused|econnreset|500|502|503/i.test(rawMessage);
  return {
    errorCode: numericCode ? String(numericCode) : (code ? String(code) : 'UNKNOWN'),
    category: isNetworkOrTimeout ? 'NETWORK_ERROR' : 'UNKNOWN',
    title: rawMessage || 'Delivery Failed',
    description: rawMessage || 'An unexpected error was returned by WhatsApp.',
    action: isNetworkOrTimeout ? 'Temporary network issue. Can be retried.' : 'Inspect raw error details or contact support.',
    isRecoverable: isNetworkOrTimeout,
    rawMessage: rawMessage || 'Unknown delivery failure',
  };
};

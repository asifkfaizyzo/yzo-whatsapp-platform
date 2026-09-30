// src/modules/zoho/zohoConstants.js

export const ZOHO_DC_MAP = {
  us: {
    location: 'us',
    accountsDomain: 'accounts.zoho.com',
    apiDomain: 'https://www.zohoapis.com',
    label: 'United States',
  },
  eu: {
    location: 'eu',
    accountsDomain: 'accounts.zoho.eu',
    apiDomain: 'https://www.zohoapis.eu',
    label: 'Europe',
  },
  in: {
    location: 'in',
    accountsDomain: 'accounts.zoho.in',
    apiDomain: 'https://www.zohoapis.in',
    label: 'India',
  },
  au: {
    location: 'au',
    accountsDomain: 'accounts.zoho.com.au',
    apiDomain: 'https://www.zohoapis.com.au',
    label: 'Australia',
  },
  jp: {
    location: 'jp',
    accountsDomain: 'accounts.zoho.jp',
    apiDomain: 'https://www.zohoapis.jp',
    label: 'Japan',
  },
  ca: {
    location: 'ca',
    accountsDomain: 'accounts.zohocloud.ca',
    apiDomain: 'https://www.zohoapis.ca',
    label: 'Canada',
  },
  sa: {
    location: 'sa',
    accountsDomain: 'accounts.zoho.sa',
    apiDomain: 'https://www.zohoapis.sa',
    label: 'Saudi Arabia',
  },
  uk: {
    location: 'uk',
    accountsDomain: 'accounts.zoho.uk',
    apiDomain: 'https://www.zohoapis.uk',
    label: 'United Kingdom',
  },
};

/**
 * Phase 1-3 Scopes (connection + contact sync)
 */
export const ZOHO_BASE_SCOPES = [
  'ZohoCRM.modules.ALL',
  'ZohoCRM.users.ALL',
];

/**
 * Phase 4+ Scopes (plan detection + notifications + settings)
 * Enhanced with ZohoCRM.org.READ for native plan detection
 */
export const ZOHO_EXTENDED_SCOPES = [
  'ZohoCRM.settings.ALL',
  'ZohoCRM.notifications.ALL',
  'ZohoCRM.org.READ',
];

/**
 * All scopes combined — used for new connections
 */
export const ZOHO_PHASE_1_SCOPES = [
  ...ZOHO_BASE_SCOPES,
  ...ZOHO_EXTENDED_SCOPES,
];

export const ZOHO_DEFAULT_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
export const ZOHO_STATE_REDIS_PREFIX = 'zoho_oauth_state:';
export const ZOHO_STATE_TTL_SECONDS = 600;
export const ZOHO_LOCK_TTL_SECONDS = 30;
export const ZOHO_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Plan Detection Cache
 */
export const ZOHO_PLAN_CACHE_PREFIX = 'zoho_plan:';
export const ZOHO_PLAN_CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * Feature availability by Zoho edition
 */
export const ZOHO_FEATURE_MATRIX = {
  Free:         { contacts: true, leads: true, tasks: true, deals: false, notes: true, webhooks: false, customModules: false, blueprints: false },
  Standard:     { contacts: true, leads: true, tasks: true, deals: true,  notes: true, webhooks: false, customModules: false, blueprints: false },
  Professional: { contacts: true, leads: true, tasks: true, deals: true,  notes: true, webhooks: true,  customModules: false, blueprints: false },
  Enterprise:   { contacts: true, leads: true, tasks: true, deals: true,  notes: true, webhooks: true,  customModules: true,  blueprints: true  },
  Ultimate:     { contacts: true, leads: true, tasks: true, deals: true,  notes: true, webhooks: true,  customModules: true,  blueprints: true  },
  Trial:        { contacts: true, leads: true, tasks: true, deals: true,  notes: true, webhooks: true,  customModules: true,  blueprints: true  },
};
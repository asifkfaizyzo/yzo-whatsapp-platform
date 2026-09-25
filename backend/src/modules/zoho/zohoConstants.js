// src/modules/zoho/zohoConstants.js

/**
 * Zoho Data Center (DC) domain maps.
 * Maps location codes returned in the OAuth callback to their respective
 * Accounts (token/auth) and API base URLs.
 */
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
 * Phase 1 Minimal OAuth Scopes
 * Strictly limited to:
 * - CRM Contact & Module read/write
 * - User profile identity check
 */
export const ZOHO_PHASE_1_SCOPES = [
  'ZohoCRM.modules.ALL',
  'ZohoCRM.users.ALL',
];

/**
 * Default Zoho Accounts authorization entry point for Multi-DC apps.
 */
export const ZOHO_DEFAULT_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';

/**
 * Redis Key Prefix & TTL Constants
 */
export const ZOHO_STATE_REDIS_PREFIX = 'zoho_oauth_state:';
export const ZOHO_STATE_TTL_SECONDS = 600; // 10 minutes
export const ZOHO_LOCK_TTL_SECONDS = 30;
export const ZOHO_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer
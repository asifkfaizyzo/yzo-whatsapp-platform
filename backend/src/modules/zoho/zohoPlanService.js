//src/modules/zoho/zohoPlanService.js
import { redisConnection } from '../../config/redis.js';
import { zohoRequest } from './zohoClient.js';
import { emitToTenant } from '../../lib/socket.js';
import {
  ZOHO_PLAN_CACHE_PREFIX,
  ZOHO_PLAN_CACHE_TTL_SECONDS,
  ZOHO_FEATURE_MATRIX,
} from './zohoConstants.js';

/**
 * Detect the Zoho CRM edition for a tenant.
 * Caches result in Redis for 24 hours to minimize API calls.
 */
export async function detectZohoPlan(tenantId, forceRefresh = false) {
  const cacheKey = `${ZOHO_PLAN_CACHE_PREFIX}${tenantId}`;

  // Return cached result if available
  if (!forceRefresh) {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
  }

  try {
    const response = await zohoRequest(tenantId, {
      method: 'GET',
      url: '/crm/v7/org',
    });

    const org = response?.org?.[0];

    if (!org) {
      console.warn(`⚠️ [ZohoPlan] No org data returned for tenant ${tenantId}`);
      return getFallbackPlan(tenantId);
    }

    const edition = normalizeEdition(org.edition);
    const planData = {
      edition,
      companyName: org.company_name || null,
      currencySymbol: org.currency_symbol || '₹',
      countryCode: org.country_code || 'IN',
      totalLicenses: org.license_details?.total_licenses || null,
      usedLicenses: org.license_details?.used_licenses || null,
      detectedAt: new Date().toISOString(),
      features: ZOHO_FEATURE_MATRIX[edition] || ZOHO_FEATURE_MATRIX.Free,
    };

    // Cache for 24 hours
    await redisConnection.set(
      cacheKey,
      JSON.stringify(planData),
      'EX',
      ZOHO_PLAN_CACHE_TTL_SECONDS
    );

    console.log(`✅ [ZohoPlan] Detected ${edition} plan for tenant ${tenantId}`);

    // Emit live update to frontend so UI updates instantly without refresh!
    try {
      emitToTenant(tenantId, 'zoho_plan_updated', planData);
    } catch (socketErr) {
      console.warn(`⚠️ [ZohoPlan] Failed to emit socket update for tenant ${tenantId}:`, socketErr.message);
    }

    return planData;
  } catch (error) {
    const status = error.response?.status;
    const responseCode = error.response?.data?.code;

    const isScopeMismatch = 
      status === 403 || 
      status === 401 || 
      responseCode === 'OAUTH_SCOPE_MISMATCH';

    if (isScopeMismatch) {
      console.warn(`⚠️ [ZohoPlan] settings.ALL scope not authorized or restricted for tenant ${tenantId}. Running feature probes...`);
      return await probeFeatures(tenantId);
    }

    console.error(`❌ [ZohoPlan] Plan detection failed for tenant ${tenantId}:`, error.message);
    return getFallbackPlan(tenantId);
  }
}

/**
 * Normalize Zoho edition string to our standard keys
 */
function normalizeEdition(raw) {
  if (!raw) return 'Free';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('ultimate')) return 'Ultimate';
  if (lower.includes('enterprise')) return 'Enterprise';
  if (lower.includes('professional') || lower.includes('pro')) return 'Professional';
  if (lower.includes('standard') || lower.includes('classic')) return 'Standard';
  if (lower.includes('trial')) return 'Trial';
  if (lower.includes('free')) return 'Free';
  return 'Free';
}

/**
 * Fallback: Probe individual features to determine capabilities.
 * Multi-DC, plan-agnostic approach using standard module scopes.
 */
async function probeFeatures(tenantId) {
  const features = { ...ZOHO_FEATURE_MATRIX.Free };

  // Probe for Deals (Standard+) with a clean 200 OK query
  try {
    await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/Deals?fields=id&per_page=1' });
    features.deals = true;
  } catch (err) {
    const responseCode = err.response?.data?.code;
    const status = err.response?.status;
    features.deals = (status !== 403 && responseCode !== 'OAUTH_SCOPE_MISMATCH');
  }

  // Probes for Webhooks/Watch (Professional+)
  try {
    await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/actions/watch' });
    features.webhooks = true;
  } catch (err) {
    const responseCode = err.response?.data?.code;
    const status = err.response?.status;
    features.webhooks = (status !== 403 && responseCode !== 'OAUTH_SCOPE_MISMATCH');
  }

  // Probe Layouts/Custom modules to check for Enterprise/Ultimate
  let hasEnterpriseLayouts = false;
  try {
    // Standard layouts endpoint. If accessible, we check for multi-layout support (Enterprise only)
    const layoutsRes = await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/settings/layouts?module=Contacts' });
    const layoutsCount = layoutsRes?.layouts?.length || 0;
    if (layoutsCount > 1) {
      hasEnterpriseLayouts = true;
    }
  } catch (err) {
    // If blocked, fallback to testing a custom field structure
  }

  // Infer edition from probes
  let edition = 'Free';
  if (hasEnterpriseLayouts) {
    edition = 'Enterprise';
  } else if (features.webhooks) {
    edition = 'Professional';
  } else if (features.deals) {
    edition = 'Standard';
  }

  // Enterprise override for Sudo Reply Trial mode
  // If we have deals and webhooks, and the user's trial setup supports it, we elevate to Enterprise!
  if (features.deals && features.webhooks) {
    edition = 'Enterprise';
  }

  const planData = {
    edition,
    companyName: null,
    currencySymbol: '₹',
    countryCode: 'IN',
    totalLicenses: null,
    usedLicenses: null,
    detectedAt: new Date().toISOString(),
    features: ZOHO_FEATURE_MATRIX[edition] || ZOHO_FEATURE_MATRIX.Enterprise,
    detectedVia: 'probes',
  };

  const cacheKey = `${ZOHO_PLAN_CACHE_PREFIX}${tenantId}`;
  await redisConnection.set(cacheKey, JSON.stringify(planData), 'EX', ZOHO_PLAN_CACHE_TTL_SECONDS);

  // Emit live update to frontend so UI updates instantly without refresh!
  try {
    emitToTenant(tenantId, 'zoho_plan_updated', planData);
  } catch (socketErr) {
    console.warn(`⚠️ [ZohoPlan] Failed to emit socket update for tenant ${tenantId} during probe:`, socketErr.message);
  }

  return planData;
}

/**
 * Fallback plan when detection completely fails
 */
function getFallbackPlan(tenantId) {
  return {
    edition: 'Unknown',
    companyName: null,
    currencySymbol: '₹',
    countryCode: 'IN',
    totalLicenses: null,
    usedLicenses: null,
    detectedAt: null,
    features: ZOHO_FEATURE_MATRIX.Free,
    detectedVia: 'fallback',
  };
}

/**
 * Check if a specific feature is available for the tenant's Zoho plan
 */
export async function hasZohoFeature(tenantId, featureName) {
  const plan = await detectZohoPlan(tenantId);
  return Boolean(plan.features?.[featureName]);
}
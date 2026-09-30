// src/modules/zoho/zohoPlanService.js

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
 * Caches result in Redis for 24 hours unless forceRefresh = true.
 */
export async function detectZohoPlan(tenantId, forceRefresh = false) {
  const cacheKey = `${ZOHO_PLAN_CACHE_PREFIX}${tenantId}`;

  // Return cached result if available and not forcing refresh
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

    // 🔍 Debug log to see exact fields returned by Zoho CRM API
    console.log('🔍 [ZohoPlan Debug] Raw Org Data:', JSON.stringify(org, null, 2));

    if (!org) {
      console.warn(`⚠️ [ZohoPlan] No org data returned for tenant ${tenantId}, probing features...`);
      return await probeFeatures(tenantId);
    }

    // 1. Check Trial Details First (Zoho Trial accounts store the actual tier here)
    const licenseDetails = org.license_details || {};
    const isTrial = Boolean(
      org.is_trial ||
      licenseDetails.trial_type ||
      licenseDetails.trial_expiry ||
      org.trial_days_remaining !== undefined ||
      org.trial_type
    );

    const trialType = licenseDetails.trial_type || org.trial_type || org.trial_edition;
    const paidType = licenseDetails.paid_type || org.edition || org.edition_type || org.plan_type;

    // Prioritize active trial tier over base paid tier
    const rawEdition = (isTrial && trialType) ? trialType : (paidType || 'Free');
    let edition = normalizeEdition(rawEdition, org);

    // 2. Double-Check Verification: If it resolved to "Free", but Deals or Webhooks are accessible,
    // it's an Enterprise/Professional trial that Zoho labeled as base "free"
    if (edition === 'Free') {
      const isActuallyHigherPlan = await quickProbeIfEnterpriseOrPro(tenantId);
      if (isActuallyHigherPlan) {
        edition = isActuallyHigherPlan;
        console.log(`✨ [ZohoPlan] Corrected Free label to ${edition} based on active module accessibility.`);
      }
    }

    const planData = {
      edition,
      isTrial,
      trialDaysRemaining: org.trial_days_remaining || licenseDetails.trial_days_remaining || null,
      companyName: org.company_name || null,
      currencySymbol: org.currency_symbol || '₹',
      countryCode: org.country_code || 'IN',
      totalLicenses: licenseDetails.total_licenses || org.user_count || 1,
      usedLicenses: licenseDetails.used_licenses || 1,
      detectedAt: new Date().toISOString(),
      features: ZOHO_FEATURE_MATRIX[edition] || ZOHO_FEATURE_MATRIX.Enterprise,
    };

    // Cache in Redis
    await redisConnection.set(
      cacheKey,
      JSON.stringify(planData),
      'EX',
      ZOHO_PLAN_CACHE_TTL_SECONDS
    );

    console.log(`✅ [ZohoPlan] Detected ${edition} plan (Trial: ${planData.isTrial}) for tenant ${tenantId}`);

    // Emit live socket event to update frontend instantly
    try {
      emitToTenant(tenantId, 'zoho_plan_updated', planData);
    } catch (_) {}

    return planData;
  } catch (error) {
    console.warn(`⚠️ [ZohoPlan] Direct org query failed (${error.response?.status || error.message}). Probing features...`);
    return await probeFeatures(tenantId);
  }
}

/**
 * Quick verification to detect if Deals and Webhooks are active (impossible on Zoho Free edition)
 */
async function quickProbeIfEnterpriseOrPro(tenantId) {
  try {
    // Probe 1: Deals (Standard+)
    const dealsRes = await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/Deals?fields=id&per_page=1' });
    const hasDeals = Boolean(dealsRes && !dealsRes.status);

    // Probe 2: Watch / Webhooks (Professional+)
    const watchRes = await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/actions/watch' });
    const hasWebhooks = Boolean(watchRes);

    if (hasDeals && hasWebhooks) {
      return 'Enterprise';
    } else if (hasWebhooks) {
      return 'Professional';
    } else if (hasDeals) {
      return 'Standard';
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Normalize Zoho edition string to standard keys
 */
function normalizeEdition(raw, orgData = {}) {
  if (!raw && orgData.is_trial) return 'Enterprise';
  if (!raw) return 'Free';

  const lower = String(raw).toLowerCase().trim();

  if (lower.includes('ultimate')) return 'Ultimate';
  if (lower.includes('enterprise')) return 'Enterprise';
  if (lower.includes('professional') || lower.includes('pro')) return 'Professional';
  if (lower.includes('standard') || lower.includes('classic')) return 'Standard';
  if (lower.includes('trial')) return 'Enterprise';
  if (lower.includes('free')) return 'Free';

  return 'Free';
}

/**
 * Fallback: Probe individual module access to determine edition
 */
async function probeFeatures(tenantId) {
  const features = { ...ZOHO_FEATURE_MATRIX.Free };
  let dealsAvailable = false;
  let webhooksAvailable = false;
  let customModulesAvailable = false;

  // 1. Probe Deals (Standard+)
  try {
    await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/Deals?fields=id&per_page=1' });
    dealsAvailable = true;
    features.deals = true;
  } catch (err) {
    const status = err.response?.status;
    dealsAvailable = (status !== 403 && status !== 401);
    features.deals = dealsAvailable;
  }

  // 2. Probe Webhooks / Watch (Professional+)
  try {
    await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/actions/watch' });
    webhooksAvailable = true;
    features.webhooks = true;
  } catch (err) {
    const status = err.response?.status;
    webhooksAvailable = (status !== 403 && status !== 401);
    features.webhooks = webhooksAvailable;
  }

  // 3. Probe Custom Layouts / Modules (Enterprise+)
  try {
    const res = await zohoRequest(tenantId, { method: 'GET', url: '/crm/v7/settings/layouts?module=Contacts' });
    if (res?.layouts?.length >= 1) {
      customModulesAvailable = true;
      features.customModules = true;
      features.blueprints = true;
    }
  } catch (_) {
    if (dealsAvailable && webhooksAvailable) {
      customModulesAvailable = true;
      features.customModules = true;
    }
  }

  // Infer edition based on probe results
  let edition = 'Free';
  if (customModulesAvailable || (dealsAvailable && webhooksAvailable)) {
    edition = 'Enterprise';
  } else if (webhooksAvailable) {
    edition = 'Professional';
  } else if (dealsAvailable) {
    edition = 'Standard';
  }

  const planData = {
    edition,
    isTrial: true,
    companyName: null,
    currencySymbol: '₹',
    countryCode: 'IN',
    totalLicenses: 1,
    usedLicenses: 1,
    detectedAt: new Date().toISOString(),
    features: ZOHO_FEATURE_MATRIX[edition] || ZOHO_FEATURE_MATRIX.Enterprise,
    detectedVia: 'probes',
  };

  const cacheKey = `${ZOHO_PLAN_CACHE_PREFIX}${tenantId}`;
  await redisConnection.set(cacheKey, JSON.stringify(planData), 'EX', ZOHO_PLAN_CACHE_TTL_SECONDS);

  try {
    emitToTenant(tenantId, 'zoho_plan_updated', planData);
  } catch (_) {}

  return planData;
}

/**
 * Check if a specific feature is available for the tenant's Zoho plan
 */
export async function hasZohoFeature(tenantId, featureName) {
  const plan = await detectZohoPlan(tenantId);
  return Boolean(plan.features?.[featureName]);
}
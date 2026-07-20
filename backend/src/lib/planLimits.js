import prisma from '../config/prisma.js';

/**
 * Checks if a feature is enabled for a tenant based on their active subscription plan.
 * Returns { allowed: boolean, code?: string, status?: number, message?: string }
 */
export const checkFeatureAccess = async (tenantId, featureName) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: {
        include: {
          features: {
            include: {
              feature: true
            }
          }
        }
      }
    }
  });

  if (!tenant) {
    return {
      allowed: false,
      code: 'TENANT_NOT_FOUND',
      status: 404,
      message: 'Tenant not found.'
    };
  }

  // Verify active subscription status
  const status = tenant.subscriptionStatus;
  const isActive = status === 'active' || status === 'trialing' || status === 'cancel_at_period_end';
  if (!isActive) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_INACTIVE',
      status: 403,
      message: 'Your subscription is not active. Please subscribe to a plan to access this feature.'
    };
  }

  // Enterprise plan has all features
  if (tenant.planStatus === 'enterprise_active') {
    return { allowed: true };
  }

  if (!tenant.plan) {
    return {
      allowed: false,
      code: 'PLAN_REQUIRED',
      status: 403,
      message: 'A subscription plan is required to access this feature.'
    };
  }

  // Check feature existence in features list
  const hasFeature = tenant.plan.features.some(
    pf => pf.feature.name.toLowerCase() === featureName.toLowerCase()
  );

  if (!hasFeature) {
    return {
      allowed: false,
      code: 'FEATURE_NOT_AVAILABLE',
      status: 403,
      message: `Feature "${featureName}" is not available in your current plan. Please upgrade your plan.`
    };
  }

  return { allowed: true };
};

/**
 * Checks if a limit is exceeded for a tenant based on their active subscription plan.
 * Returns { allowed: boolean, code?: string, status?: number, message?: string }
 */
export const checkLimitAccess = async (tenantId, limitName, requiredCount = 1) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: true
    }
  });

  if (!tenant) {
    return {
      allowed: false,
      code: 'TENANT_NOT_FOUND',
      status: 404,
      message: 'Tenant not found.'
    };
  }

  // Verify active subscription status
  const status = tenant.subscriptionStatus;
  const isActive = status === 'active' || status === 'trialing' || status === 'cancel_at_period_end';
  if (!isActive) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_INACTIVE',
      status: 403,
      message: 'Your subscription is not active. Please subscribe to a plan to access this resource.'
    };
  }

  // Enterprise plan is unlimited
  if (tenant.planStatus === 'enterprise_active') {
    return { allowed: true };
  }

  if (!tenant.plan) {
    return {
      allowed: false,
      code: 'PLAN_REQUIRED',
      status: 403,
      message: 'A subscription plan is required to access this resource.'
    };
  }

  const limitValue = tenant.plan[limitName];
  if (limitValue === undefined) {
    return {
      allowed: false,
      code: 'LIMIT_NOT_FOUND',
      status: 400,
      message: `Invalid limit: ${limitName}`
    };
  }

  // null means unlimited
  if (limitValue === null) {
    return { allowed: true };
  }

  let currentCount = 0;
  let limitDisplayName = '';

  if (limitName === 'maxAgents') {
    limitDisplayName = 'team members';
    currentCount = await prisma.user.count({
      where: { tenantId, isActive: true }
    });
  } else if (limitName === 'maxAutomations') {
    limitDisplayName = 'automations';
    currentCount = await prisma.flow.count({
      where: { tenantId }
    });
  } else if (limitName === 'maxCampaigns') {
    limitDisplayName = 'broadcast campaigns';
    currentCount = await prisma.broadcast.count({
      where: { tenantId }
    });
  } else if (limitName === 'maxBroadcasts') {
    limitDisplayName = 'broadcast recipients';
    const agg = await prisma.broadcast.aggregate({
      where: { tenantId },
      _sum: { totalRecipients: true }
    });
    currentCount = agg._sum.totalRecipients || 0;
  } else {
    limitDisplayName = limitName;
  }

  if (currentCount + requiredCount > limitValue) {
    return {
      allowed: false,
      code: 'PLAN_LIMIT_REACHED',
      status: 403,
      message: `The plan limit for ${limitDisplayName} (${limitValue}) has been reached. Please upgrade your plan.`
    };
  }

  return { allowed: true };
};

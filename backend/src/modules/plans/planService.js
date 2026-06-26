import prisma from "../../config/prisma.js";

// ── Get all plans (superadmin) ──
export const getAllPlans = async () => {
  return prisma.subscriptionPlan.findMany({
    include: {
      features: {
        include: { feature: true },
      },
      integrations: true,
      _count: { select: { tenants: true } },
    },
    orderBy: { monthlyPrice: "asc" },
  });
};

// ── Get public active plans (tenant pricing page — no auth) ──
export const getPublicPlans = async () => {
  return prisma.subscriptionPlan.findMany({
    where: { status: "ACTIVE" },
    include: {
      features: {
        include: { feature: true },
      },
      integrations: true,
    },
    orderBy: { monthlyPrice: "asc" },
  });
};

// ── Get single plan by ID ──
export const getPlanById = async (id) => {
  return prisma.subscriptionPlan.findUnique({
    where: { id },
    include: {
      features: { include: { feature: true } },
      integrations: true,
      _count: { select: { tenants: true } },
    },
  });
};

// ── Create plan ──
export const createPlan = async (data) => {
  const {
    name,
    description,
    monthlyPrice,
    annualPrice,
    status,
    maxAgents,
    maxBroadcasts,
    maxAutomations,
    maxCampaigns,
    maxApiCalls,
    maxAiCredits,
    featureIds,
    integrations,
  } = data;

  return prisma.subscriptionPlan.create({
    data: {
      name,
      description,
      monthlyPrice: parseFloat(monthlyPrice),
      annualPrice: annualPrice ? parseFloat(annualPrice) : null,
      status: status || "ACTIVE",
      maxAgents: parseInt(maxAgents),
      maxBroadcasts: maxBroadcasts ? parseInt(maxBroadcasts) : null,
      maxAutomations: maxAutomations ? parseInt(maxAutomations) : null,
      maxCampaigns: maxCampaigns ? parseInt(maxCampaigns) : null,
      maxApiCalls: maxApiCalls ? parseInt(maxApiCalls) : null,
      maxAiCredits: maxAiCredits ? parseInt(maxAiCredits) : null,
      features: {
        create: featureIds.map((featureId) => ({ featureId })),
      },
      integrations: {
        create: integrations.map((name) => ({ name })),
      },
    },
    include: {
      features: { include: { feature: true } },
      integrations: true,
    },
  });
};

// ── Update plan ──
export const updatePlan = async (id, data) => {
  const {
    name,
    description,
    monthlyPrice,
    annualPrice,
    status,
    maxAgents,
    maxBroadcasts,
    maxAutomations,
    maxCampaigns,
    maxApiCalls,
    maxAiCredits,
    featureIds,
    integrations,
  } = data;

  // Delete old relations first then recreate
  await prisma.planFeature.deleteMany({ where: { planId: id } });
  await prisma.planIntegration.deleteMany({ where: { planId: id } });

  return prisma.subscriptionPlan.update({
    where: { id },
    data: {
      name,
      description,
      monthlyPrice: parseFloat(monthlyPrice),
      annualPrice: annualPrice ? parseFloat(annualPrice) : null,
      status,
      maxAgents: parseInt(maxAgents),
      maxBroadcasts: maxBroadcasts ? parseInt(maxBroadcasts) : null,
      maxAutomations: maxAutomations ? parseInt(maxAutomations) : null,
      maxCampaigns: maxCampaigns ? parseInt(maxCampaigns) : null,
      maxApiCalls: maxApiCalls ? parseInt(maxApiCalls) : null,
      maxAiCredits: maxAiCredits ? parseInt(maxAiCredits) : null,
      features: {
        create: featureIds.map((featureId) => ({ featureId })),
      },
      integrations: {
        create: integrations.map((name) => ({ name })),
      },
    },
    include: {
      features: { include: { feature: true } },
      integrations: true,
    },
  });
};

// ── Toggle plan status ──
export const togglePlanStatus = async (id) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!plan) throw new Error("Plan not found");

  return prisma.subscriptionPlan.update({
    where: { id },
    data: {
      status: plan.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    },
  });
};

// ── Delete plan ──
export const deletePlan = async (id) => {
  // Check if any tenants are on this plan
  const tenantCount = await prisma.tenant.count({
    where: { planId: id },
  });

  if (tenantCount > 0) {
    throw new Error(
      `Cannot delete — ${tenantCount} tenant(s) are on this plan`
    );
  }

  return prisma.subscriptionPlan.delete({ where: { id } });
};

// ── Get all features ──
export const getAllFeatures = async () => {
  return prisma.feature.findMany({
    orderBy: { name: "asc" },
  });
};

// ── Create feature ──
export const createFeature = async (name) => {
  return prisma.feature.upsert({
    where: { name },
    update: {},
    create: { name },
  });
};

// ── Delete feature ──
export const deleteFeature = async (id) => {
  return prisma.feature.delete({ where: { id } });
};
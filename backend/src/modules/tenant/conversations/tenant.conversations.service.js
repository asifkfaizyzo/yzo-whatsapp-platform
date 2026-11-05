// backend/src/modules/tenant/conversations/tenant.conversations.service.js (do not remove this comment)
import prisma from "../../../config/prisma.js";

export const listConversations = async (tenantId, options = {}) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const conversations = await prisma.conversation.findMany({
    where: { tenantId },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    skip,
    take: limit,
  });

  const total = await prisma.conversation.count({
    where: { tenantId },
  });

  return {
    conversations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAutoReopenConfigService = async (tenantId) => {
  if (!tenantId) throw new Error("Tenant ID is required");

  let config = await prisma.autoReopenConfig.findUnique({
    where: { tenantId },
  });

  if (!config) {
    config = await prisma.autoReopenConfig.create({
      data: {
        tenantId,
        enabled: true,
        reopenWindowHours: 72,
        maxReopenCount: 5,
        smartFilterEnabled: true,
        assignmentStrategy: "original_agent",
      },
    });
  }

  return config;
};

export const updateAutoReopenConfigService = async (tenantId, data) => {
  if (!tenantId) throw new Error("Tenant ID is required");

  return await prisma.autoReopenConfig.upsert({
    where: { tenantId },
    update: {
      enabled: data.enabled,
      reopenWindowHours: data.reopenWindowHours,
      maxReopenCount: data.maxReopenCount,
      smartFilterEnabled: data.smartFilterEnabled,
      assignmentStrategy: data.assignmentStrategy,
    },
    create: {
      tenantId,
      enabled: data.enabled ?? true,
      reopenWindowHours: data.reopenWindowHours ?? 72,
      maxReopenCount: data.maxReopenCount ?? 5,
      smartFilterEnabled: data.smartFilterEnabled ?? true,
      assignmentStrategy: data.assignmentStrategy ?? "original_agent",
    },
  });
};

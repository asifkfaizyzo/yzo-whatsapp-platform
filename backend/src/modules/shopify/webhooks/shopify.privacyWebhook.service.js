// backend/src/modules/shopify/webhooks/shopify.privacyWebhook.service.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { orderWebhookQueue } from "../../../cron/queues/order-webhook.queue.js";
import { dlqQueue } from "../../../cron/queues/dlq.queue.js";

const SHOPIFY_REDACTION_JOB_NAMES = new Set([
  "shopify-privacy",
  "shopify-order",
  "shopify-cart-1h",
  "shopify-cart-24h",
  "shopify-cart-48h",
  "shopify-review-request",
  "shopify-cross-sell",
  "shopify-upsell",
  "shopify-reorder-reminder",
  "shopify-win-back",
  "shopify-payment-reminder",
]);
const QUEUE_STATES = [
  "waiting", "active", "delayed", "completed", "failed",
  "waiting-children", "prioritized", "paused",
];
const QUEUE_PAGE_SIZE = 100;

const getAllJobs = async (queue) => {
  const jobs = [];
  for (const state of QUEUE_STATES) {
    for (let start = 0; ; start += QUEUE_PAGE_SIZE) {
      const page = await queue.getJobs([state], start, start + QUEUE_PAGE_SIZE - 1, false);
      jobs.push(...page);
      if (page.length < QUEUE_PAGE_SIZE) break;
    }
  }
  return jobs;
};

const cleanupShopifyQueueJobs = async (storeId) => {
  let removed = 0;
  const jobs = await getAllJobs(orderWebhookQueue);
  for (const job of jobs) {
    if (job.name === undefined || !SHOPIFY_REDACTION_JOB_NAMES.has(job.name)) continue;
    if (job.data?.storeId !== storeId) continue;
    // BullMQ will reject removal of a locked active job. Leave it to processor protections.
    if (await job.getState() === "active") continue;
    await job.remove();
    removed += 1;
  }
  return removed;
};

const cleanupShopifyDlqJobs = async (storeId) => {
  let removed = 0;
  const jobs = await getAllJobs(dlqQueue);
  for (const job of jobs) {
    const data = job.data;
    if (
      data?.originalQueue !== "order-webhook-events" ||
      !SHOPIFY_REDACTION_JOB_NAMES.has(data?.originalJobName) ||
      data?.originalData?.storeId !== storeId
    ) continue;
    if (await job.getState() === "active") continue;
    await job.remove();
    removed += 1;
  }
  return removed;
};

const cleanupShopifyStoreJobs = async (storeId) => {
  // Repeat the scans so failures transferred to the DLQ during cleanup are caught.
  let queueRemoved = 0;
  let dlqRemoved = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    queueRemoved += await cleanupShopifyQueueJobs(storeId);
    dlqRemoved += await cleanupShopifyDlqJobs(storeId);
  }
  return { queueRemoved, dlqRemoved };
};

const getRequiredString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const processShopifyPrivacyWebhook = async (jobData) => {
  const topic = jobData?.topic;
  if (!["customers/redact", "shop/redact"].includes(topic)) {
    return {
      success: true,
      status: "ignored",
      reason: "unsupported_topic",
    };
  }

  const tenantId = getRequiredString(jobData.tenantId);
  const storeId = getRequiredString(jobData.storeId);
  const shopDomain = getRequiredString(jobData.shopDomain)?.toLowerCase();
  const shopifyCustomerId =
    topic === "customers/redact"
      ? getRequiredString(jobData.customerId)
      : null;

  if (
    !tenantId ||
    !storeId ||
    !shopDomain ||
    (topic === "customers/redact" && !shopifyCustomerId)
  ) {
    return {
      success: false,
      status: "invalid",
      reason: "missing_required_fields",
    };
  }

  const store = await prisma.shopifyStore.findFirst({
    where: { id: storeId, tenantId, shopDomain },
    select: {
      id: true,
      tenantId: true,
      shopDomain: true,
      status: true,
      redactedAt: true,
    },
  });

  if (!store) {
    return {
      success: false,
      status: "invalid",
      reason: "store_identity_mismatch",
    };
  }

  if (topic === "shop/redact") {
    const alreadyRedacted = Boolean(store.redactedAt) || store.status === "redacted";
    const redactedAt = store.redactedAt || new Date();

    try {
      const marker = await prisma.shopifyStore.updateMany({
        where: { id: storeId, tenantId, shopDomain },
        data: { status: "redacted", redactedAt },
      });

      if (marker.count === 0) {
        return {
          success: false,
          status: "invalid",
          reason: "store_identity_mismatch",
        };
      }
    } catch {
      throw new Error("Shopify store redaction marker update failed");
    }

    try {
      const deleted = await prisma.$transaction(async (tx) => {
        const connection = await tx.shopifyConnection.deleteMany({
          where: { tenantId, storeId },
        });
        const ecommerceOrders = await tx.ecommerceOrder.deleteMany({
          where: {
            tenantId,
            source: "SHOPIFY",
            shopifyStoreId: storeId,
          },
        });
        const messages = await tx.message.deleteMany({
          where: { source: "SHOPIFY", shopifyStoreId: storeId },
        });
        const customerMappings = await tx.shopifyCustomerMapping.deleteMany({
          where: { tenantId, storeId },
        });
        // ContactProviderMapping has no store key; retain it. Shopify event IDs
        // include the exact store ID and delimiter, so only those are removable.
        const webhookEvents = await tx.webhookEvent.deleteMany({
          where: {
            tenantId,
            provider: "SHOPIFY",
            eventId: { startsWith: `shopify:${storeId}:` },
          },
        });

        return {
          connections: connection.count,
          ecommerceOrders: ecommerceOrders.count,
          messages: messages.count,
          customerMappings: customerMappings.count,
          webhookEvents: webhookEvents.count,
        };
      });

      let queueCleanup;
      try {
        queueCleanup = await cleanupShopifyStoreJobs(storeId);
      } catch {
        // The marker and database transaction remain committed; retries repeat this cleanup.
        throw new Error("Shopify store redaction queue cleanup failed; store remains redacted");
      }

      return {
        success: true,
        status: alreadyRedacted ? "repeated" : "redacted",
        deleted,
        queueCleanup,
      };
    } catch {
      // The marker is committed separately; retries safely finish this cleanup.
      throw new Error("Shopify store redaction cleanup failed; store remains redacted");
    }
  }

  let alreadyRedacted = false;
  try {
    await prisma.shopifyCustomerRedaction.create({
      data: { storeId, tenantId, shopifyCustomerId },
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;

    const existingRedaction = await prisma.shopifyCustomerRedaction.findUnique({
      where: {
        storeId_shopifyCustomerId: { storeId, shopifyCustomerId },
      },
      select: { tenantId: true },
    });

    if (!existingRedaction || existingRedaction.tenantId !== tenantId) {
      return {
        success: false,
        status: "invalid",
        reason: "redaction_identity_mismatch",
      };
    }

    alreadyRedacted = true;
  }

  // Keep the tombstone committed independently so cleanup retries cannot lose it.
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const customerMapping = await tx.shopifyCustomerMapping.deleteMany({
        where: { tenantId, storeId, shopifyCustomerId },
      });
      const ecommerceOrders = await tx.ecommerceOrder.deleteMany({
        where: {
          tenantId,
          source: "SHOPIFY",
          shopifyStoreId: storeId,
          shopifyCustomerId,
        },
      });
      const messages = await tx.message.deleteMany({
        where: {
          source: "SHOPIFY",
          shopifyStoreId: storeId,
          shopifyCustomerId,
        },
      });
      const providerMappings = await tx.contactProviderMapping.deleteMany({
        where: {
          tenantId,
          provider: "SHOPIFY",
          providerContactId: shopifyCustomerId,
        },
      });

      return {
        customerMappings: customerMapping.count,
        ecommerceOrders: ecommerceOrders.count,
        messages: messages.count,
        providerMappings: providerMappings.count,
      };
    });

    return {
      success: true,
      status: alreadyRedacted ? "repeated" : "redacted",
      deleted,
    };
  } catch {
    // Do not include customer or store identifiers in the error sent to worker logs/DLQ.
    throw new Error("Shopify customer redaction cleanup failed; tombstone retained");
  }
};

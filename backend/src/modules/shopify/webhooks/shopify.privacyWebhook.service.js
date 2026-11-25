// backend/src/modules/shopify/webhooks/shopify.privacyWebhook.service.js (do not remove this comment)
import fs from "node:fs/promises";
import prisma from "../../../config/prisma.js";
import { orderWebhookQueue } from "../../../cron/queues/order-webhook.queue.js";
import { dlqQueue } from "../../../cron/queues/dlq.queue.js";

const SHOPIFY_REDACTION_JOB_NAMES = new Set([
  "shopify-privacy",
  "shopify-customer-data-export",
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

const invalidateShopifyCustomerExports = async ({
  tenantId,
  storeId,
  shopifyCustomerId,
}) => {
  const exports = await prisma.shopifyCustomerDataExport.findMany({
    where: {
      tenantId,
      storeId,
      shopifyCustomerId,
    },
    select: {
      id: true,
      filePath: true,
    },
  });

  if (!exports.length) return 0;

  await prisma.shopifyCustomerDataExport.updateMany({
    where: {
      tenantId,
      storeId,
      shopifyCustomerId,
    },
    data: {
      status: "REDACTED",
      filePath: null,
      downloadTokenHash: null,
      expiresAt: null,
      failureReason: "Invalidated due to Shopify customer redaction",
    },
  });

  for (const exportRecord of exports) {
    if (!exportRecord.filePath) continue;

    try {
      await fs.unlink(exportRecord.filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return exports.length;
};

const getRequiredString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;


export const processShopifyPrivacyWebhook = async (jobData) => {
  const topic = jobData?.topic;

  if (
    !["customers/data_request", "customers/redact", "shop/redact"].includes(topic)
  ) {
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
    topic === "shop/redact" ? null : getRequiredString(jobData.customerId);

  if (
    !tenantId ||
    !storeId ||
    !shopDomain ||
    (topic !== "shop/redact" && !shopifyCustomerId)
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

  // Shopify customer data request: create an idempotent export request.
  if (topic === "customers/data_request") {
    if (store.status === "redacted" || store.redactedAt) {
      return {
        success: false,
        status: "invalid",
        reason: "store_already_redacted",
      };
    }

    // Do not create another export after this customer's redaction.
    const customerRedaction = await prisma.shopifyCustomerRedaction.findUnique({
      where: {
        storeId_shopifyCustomerId: {
          storeId,
          shopifyCustomerId,
        },
      },
      select: { id: true },
    });

    if (customerRedaction) {
      return {
        success: false,
        status: "invalid",
        reason: "customer_already_redacted",
      };
    }

    const webhookId = getRequiredString(jobData.webhookId);

    if (!webhookId) {
      return {
        success: false,
        status: "invalid",
        reason: "missing_webhook_id",
      };
    }

    let exportRequest;

    try {
      exportRequest = await prisma.shopifyCustomerDataExport.create({
        data: {
          tenantId,
          storeId,
          shopifyCustomerId,
          webhookId,
          status: "PENDING",
        },
        select: { id: true },
      });
    } catch (error) {
      if (error?.code !== "P2002") {
        throw error;
      }

      exportRequest = await prisma.shopifyCustomerDataExport.findUnique({
        where: {
          storeId_webhookId: {
            storeId,
            webhookId,
          },
        },
        select: {
          id: true,
          tenantId: true,
          shopifyCustomerId: true,
        },
      });

      if (
        !exportRequest ||
        exportRequest.tenantId !== tenantId ||
        exportRequest.shopifyCustomerId !== shopifyCustomerId
      ) {
        return {
          success: false,
          status: "invalid",
          reason: "export_request_identity_mismatch",
        };
      }
    }

    await orderWebhookQueue.add(
      "shopify-customer-data-export",
      {
        exportId: exportRequest.id,
        tenantId,
        storeId,
        shopDomain,
        shopifyCustomerId,
      },
      {
        jobId: `shopify_customer_export_${exportRequest.id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
      },
    );

    return {
      success: true,
      status: "queued",
      exportId: exportRequest.id,
    };
  }

  // Shopify shop redaction.
  if (topic === "shop/redact") {
    const alreadyRedacted =
      Boolean(store.redactedAt) || store.status === "redacted";
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

      // Invalidate every export belonging to this Shopify store.
      const storeExports = await prisma.shopifyCustomerDataExport.findMany({
        where: { tenantId, storeId },
        select: {
          id: true,
          filePath: true,
        },
      });

      await prisma.shopifyCustomerDataExport.updateMany({
        where: { tenantId, storeId },
        data: {
          status: "REDACTED",
          filePath: null,
          downloadTokenHash: null,
          expiresAt: null,
          failureReason: "Invalidated due to Shopify shop redaction",
        },
      });

      for (const exportRecord of storeExports) {
        if (!exportRecord.filePath) continue;

        try {
          await fs.unlink(exportRecord.filePath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }

      let queueCleanup;

      try {
        queueCleanup = await cleanupShopifyStoreJobs(storeId);
      } catch {
        throw new Error(
          "Shopify store redaction queue cleanup failed; store remains redacted",
        );
      }

      return {
        success: true,
        status: alreadyRedacted ? "repeated" : "redacted",
        deleted,
        invalidatedExports: storeExports.length,
        queueCleanup,
      };
    } catch {
      throw new Error(
        "Shopify store redaction cleanup failed; store remains redacted",
      );
    }
  }

  // Shopify customer redaction.
  let alreadyRedacted = false;

  try {
    await prisma.shopifyCustomerRedaction.create({
      data: { storeId, tenantId, shopifyCustomerId },
    });
  } catch (error) {
    if (error?.code !== "P2002") {
      throw error;
    }

    const existingRedaction =
      await prisma.shopifyCustomerRedaction.findUnique({
        where: {
          storeId_shopifyCustomerId: {
            storeId,
            shopifyCustomerId,
          },
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
      const providerMappings = { count: 0 };
      return {
        customerMappings: customerMapping.count,
        ecommerceOrders: ecommerceOrders.count,
        messages: messages.count,
        providerMappings: providerMappings.count,
      };
    });

    // Invalidate this customer's exports and delete their private files.
    const invalidatedExports = await invalidateShopifyCustomerExports({
      tenantId,
      storeId,
      shopifyCustomerId,
    });

    // Remove only queued jobs that can be positively matched to this customer.
    let queueRemoved = 0;
    let dlqRemoved = 0;

    for (let pass = 0; pass < 2; pass += 1) {
      const jobs = await getAllJobs(orderWebhookQueue);

      for (const job of jobs) {
        if (
          !SHOPIFY_REDACTION_JOB_NAMES.has(job.name) ||
          job.data?.storeId !== storeId
        ) {
          continue;
        }

        const jobCustomerId =
          job.data?.shopifyCustomerId ?? job.data?.customerId;

        if (jobCustomerId !== shopifyCustomerId) continue;
        if (await job.getState() === "active") continue;

        await job.remove();
        queueRemoved += 1;
      }

      const dlqJobs = await getAllJobs(dlqQueue);

      for (const job of dlqJobs) {
        const data = job.data;
        const originalData = data?.originalData;

        if (
          data?.originalQueue !== "order-webhook-events" ||
          !SHOPIFY_REDACTION_JOB_NAMES.has(data?.originalJobName) ||
          originalData?.storeId !== storeId
        ) {
          continue;
        }

        const jobCustomerId =
          originalData?.shopifyCustomerId ?? originalData?.customerId;

        if (jobCustomerId !== shopifyCustomerId) continue;
        if (await job.getState() === "active") continue;

        await job.remove();
        dlqRemoved += 1;
      }
    }

    return {
      success: true,
      status: alreadyRedacted ? "repeated" : "redacted",
      deleted,
      invalidatedExports,
      queueCleanup: {
        queueRemoved,
        dlqRemoved,
      },
    };
  } catch {
    throw new Error(
      "Shopify customer redaction cleanup failed; tombstone retained",
    );
  }
};
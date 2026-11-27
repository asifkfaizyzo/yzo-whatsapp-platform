// backend/src/cron/workers/orderWebhookWorker.js (do not remove this comment)
import { Worker } from "bullmq";
import { QUEUE_NAME_ORDER_WEBHOOK } from "../queues/order-webhook.queue.js";
import { redisConnection } from "../../config/redis.js";
import { processOrderWebhookJob } from "../../modules/webhook/order.webhook.controller.js";
import { dlqQueue } from "../queues/dlq.queue.js";

// ── Cart Recovery Job Router ──
const routeJob = async (job) => {
  if (job.name === "woocommerce-cart-event") {
    const { handleWooCommerceCartEvent } =
      await import("../../modules/woocommerce/woocommerce.cartRecovery.service.js");
    return handleWooCommerceCartEvent(job.data);
  }
  // Shopify cart recovery jobs
  if (job.name?.startsWith("shopify-cart-")) {
    const { processCartReminder } =
      await import("../../modules/shopify/orders/shopify.cartRecovery.service.js");
    return processCartReminder(job.data);
  }

  // ── Shopify Post-Purchase Engagement Jobs ──
  if (job.name === "shopify-review-request") {
    const { processReviewRequestJob } =
      await import("../../modules/shopify/orders/shopify.postPurchase.service.js");
    return processReviewRequestJob(job.data);
  }
  if (job.name === "shopify-cross-sell") {
    const { processCrossSellJob } =
      await import("../../modules/shopify/orders/shopify.postPurchase.service.js");
    return processCrossSellJob(job.data);
  }
  if (job.name === "shopify-upsell") {
    const { processUpsellJob } =
      await import("../../modules/shopify/orders/shopify.postPurchase.service.js");
    return processUpsellJob(job.data);
  }
  if (job.name === "shopify-reorder-reminder") {
    const { processReorderReminderJob } =
      await import("../../modules/shopify/orders/shopify.postPurchase.service.js");
    return processReorderReminderJob(job.data);
  }
  if (job.name === "shopify-win-back") {
    const { processWinBackJob } =
      await import("../../modules/shopify/orders/shopify.postPurchase.service.js");
    return processWinBackJob(job.data);
  }
  // WooCommerce cart recovery jobs (future)
  if (job.name?.startsWith("woo-cart-")) {
    const { processCartReminder } =
      await import("../../modules/woocommerce/woocommerce.cartRecovery.service.js");
    return processCartReminder(job.data);
  }

  // Shopify mandatory privacy webhook jobs
  if (job.name === "shopify-privacy") {
    const { processShopifyPrivacyWebhook } =
      await import("../../modules/shopify/webhooks/shopify.privacyWebhook.service.js");
    return processShopifyPrivacyWebhook(job.data);
  }

    // Shopify customer data export jobs
  if (job.name === "shopify-customer-data-export") {
    const { processShopifyCustomerDataExport } =
      await import("../../modules/shopify/webhooks/shopify.customerDataExport.service.js");
    return processShopifyCustomerDataExport(job.data);
  }
  
  // All other order webhook jobs (orders/create, orders/updated, etc.)
  return processOrderWebhookJob(job);
};

export const startOrderWebhookWorker = () => {
  const worker = new Worker(QUEUE_NAME_ORDER_WEBHOOK, routeJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    const eventName = job.data?.topic || job.data?.event || job.name;
    console.log(
      `✅ [OrderWebhookWorker] Job ${job.id} (${eventName}) processed successfully`,
    );
  });

  
  worker.on("failed", async (job, err) => {
    console.error(
      `❌ [OrderWebhookWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`,
      err.message,
    );

    if (job && job.attemptsMade >= job.opts.attempts) {
      const isShopifyPrivacyJob = [
        "shopify-privacy",
        "shopify-customer-data-export",
      ].includes(job.name);

      const dlqPayload = {
        originalJobId: job.id,
        originalJobName: job.name,
        originalData: job.data,
        failedAt: new Date().toISOString(),
        attempts: job.attemptsMade,
        errorMessage: err.message,
        errorStack: err.stack,
        errorName: err.name,
        originalQueue: QUEUE_NAME_ORDER_WEBHOOK,
        processingTime: job.processedOn
          ? Date.now() - job.processedOn
          : null,
      };

      // Shopify privacy jobs: retry DLQ insertion up to 3 times.
      if (isShopifyPrivacyJob) {
        const dlqJobId = `dlq_shopify_${job.id}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await dlqQueue.add(
              "failed-order-webhook",
              dlqPayload,
              { jobId: dlqJobId },
            );

            console.warn(
              `📮 [Shopify DLQ] Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`,
            );
            return;
          } catch (dlqErr) {
            console.error(
              `[Shopify DLQ] Insertion attempt ${attempt}/3 failed for job ${job.id}:`,
              dlqErr.message,
            );
          }
        }

        console.error(
          `[Shopify DLQ] All 3 insertion attempts failed for job ${job.id}. Original failed job remains retained in the order queue.`,
        );
        return;
      }

      // Existing non-Shopify DLQ behaviour remains unchanged.
      try {
        await dlqQueue.add(
          "failed-order-webhook",
          dlqPayload,
          { jobId: `dlq_order_rzp_${job.id}_${Date.now()}` },
        );

        console.warn(
          `📮 [DLQ] Order webhook job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`,
        );
      } catch (dlqErr) {
        console.error(
          "⚠️ [DLQ] Failed to push order webhook job to DLQ:",
          dlqErr.message,
        );
      }
    }
  });


  console.log(
    "👷 Order Webhook Worker started (concurrency: 5) with DLQ support",
  );
  return worker;
};

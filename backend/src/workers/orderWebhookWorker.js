// backend/src/workers/orderWebhookWorker.js
import { Worker } from 'bullmq';
import { QUEUE_NAME_ORDER_WEBHOOK } from '../queues/orderWebhookQueue.js';
import { redisConnection } from '../config/redis.js';
import { processOrderWebhookJob } from '../modules/webhook/orderWebhookController.js';
import { dlqQueue } from '../queues/dlqQueue.js';

// ── Cart Recovery Job Router ──
const routeJob = async (job) => {
  if (job.name === 'woocommerce-cart-event') {
    const { handleWooCommerceCartEvent } = await import('../modules/woocommerce/woocommerceCartRecoveryService.js');
    return handleWooCommerceCartEvent(job.data);
  }
  // Shopify cart recovery jobs
  if (job.name?.startsWith('shopify-cart-')) {
    const { processCartReminder } = await import('../modules/shopify/shopifyCartRecoveryService.js');
    return processCartReminder(job.data);
  }
  // WooCommerce cart recovery jobs (future)
  if (job.name?.startsWith('woo-cart-')) {
    const { processCartReminder } = await import('../modules/woocommerce/woocommerceCartRecoveryService.js');
    return processCartReminder(job.data);
  }
  // All other order webhook jobs (orders/create, orders/updated, etc.)
  return processOrderWebhookJob(job);
};

export const startOrderWebhookWorker = () => {
  const worker = new Worker(
     QUEUE_NAME_ORDER_WEBHOOK,
    routeJob,
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    const eventName = job.data?.topic || job.data?.event || job.name;
    console.log(`✅ [OrderWebhookWorker] Job ${job.id} (${eventName}) processed successfully`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`❌ [OrderWebhookWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);

    // If retry attempts exhausted, push to Dead Letter Queue (DLQ)
    if (job && job.attemptsMade >= job.opts.attempts) {
      try {
        await dlqQueue.add(
          'failed-order-webhook',
          {
            originalJobId: job.id,
            originalJobName: job.name,
            originalData: job.data,
            failedAt: new Date().toISOString(),
            attempts: job.attemptsMade,
            errorMessage: err.message,
            errorStack: err.stack,
            errorName: err.name,
            originalQueue: QUEUE_NAME_ORDER_WEBHOOK,
            processingTime: job.processedOn ? Date.now() - job.processedOn : null,
          },
          { jobId: `dlq_order_rzp_${job.id}_${Date.now()}` }
        );

        console.warn(`📮 [DLQ] Order webhook job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
      } catch (dlqErr) {
        console.error('⚠️ [DLQ] Failed to push order webhook job to DLQ:', dlqErr.message);
      }
    }
  });

  console.log('👷 Order Webhook Worker started (concurrency: 5) with DLQ support');
  return worker;
};

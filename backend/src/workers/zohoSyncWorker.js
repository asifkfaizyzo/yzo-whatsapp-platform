// src/workers/zohoSyncWorker.js

import { Worker } from 'bullmq';
import { QUEUE_NAME_ZOHO_SYNC } from '../queues/zohoSyncQueue.js';
import { redisConnection } from '../config/redis.js';
import { dlqQueue } from '../queues/dlqQueue.js';
import { syncTenantContactsToZoho } from '../modules/zoho/zohoContactService.js';

export const processZohoSyncJob = async (job) => {
  const { tenantId, syncType } = job.data;

  if (!tenantId) {
    throw new Error('Tenant ID is required in Zoho sync job payload');
  }

  console.log(`👷 [ZohoSyncWorker] Processing Job ${job.id} for tenant ${tenantId} (${syncType || 'FULL'})`);

  return await syncTenantContactsToZoho(tenantId, { syncType });
};

export const startZohoSyncWorker = () => {
  const worker = new Worker(
    QUEUE_NAME_ZOHO_SYNC,
    processZohoSyncJob,
    {
      connection: redisConnection,
      concurrency: 3, // Safe concurrency respecting Zoho rate limits
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ [ZohoSyncWorker] Job ${job.id} completed successfully for tenant ${job.data?.tenantId}`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`❌ [ZohoSyncWorker] Job ${job?.id} failed:`, err.message);

    if (job && job.attemptsMade >= job.opts.attempts) {
      try {
        await dlqQueue.add(
          'failed-zoho-sync',
          {
            originalJobId: job.id,
            originalJobName: job.name,
            originalData: job.data,
            failedAt: new Date().toISOString(),
            attempts: job.attemptsMade,
            errorMessage: err.message,
            errorStack: err.stack,
            originalQueue: QUEUE_NAME_ZOHO_SYNC,
          },
          { jobId: `dlq_zoho_${job.id}_${Date.now()}` }
        );

        console.warn(`📮 [DLQ] Zoho sync job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
      } catch (dlqError) {
        console.error('⚠️ [DLQ] Failed to push Zoho job to DLQ:', dlqError.message);
      }
    }
  });

  console.log('👷 Zoho sync worker started (concurrency: 3) with DLQ support');
  return worker;
};
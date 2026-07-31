// src/queues/dlqQueue.js
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const QUEUE_NAME_DLQ = 'webhook-dlq';

/**
 * Dead Letter Queue — stores webhooks that failed all retry attempts
 * 
 * Unlike the main queue:
 *   - Jobs stay here indefinitely (until admin acts)
 *   - No auto-cleanup
 *   - No automatic processing
 *   - Only manual retry by admin
 */
export const dlqQueue = new Queue(QUEUE_NAME_DLQ, {
  connection: redisConnection,
  defaultJobOptions: {
    // Keep failed jobs forever (until admin deletes)
    removeOnComplete: false,
    removeOnFail:     false,
    
    // No auto-retry (admin decides)
    attempts: 1,
  },
});

console.log('📮 Dead Letter Queue initialized');
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const QUEUE_NAME_ORDER_WEBHOOK = 'order-webhook-events';

export const orderWebhookQueue = new Queue(QUEUE_NAME_ORDER_WEBHOOK, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000 // 10s, 20s, 40s, 80s, 160s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 }
  }
});

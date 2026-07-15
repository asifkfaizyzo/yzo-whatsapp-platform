import { Queue } from 'bullmq';
import { defaultQueueOptions } from '../config/bullmq.js';

export const QUEUE_NAME_WEBHOOK = 'webhook-events';

export const webhookQueue = new Queue(QUEUE_NAME_WEBHOOK, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 5 // Retry webhook processing up to 5 times on transient DB locks
  }
});

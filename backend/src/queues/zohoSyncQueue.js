// src/queues/zohoSyncQueue.js

import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const QUEUE_NAME_ZOHO_SYNC = 'zoho-sync';

export const zohoSyncQueue = new Queue(QUEUE_NAME_ZOHO_SYNC, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
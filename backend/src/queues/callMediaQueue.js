import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const QUEUE_NAME_CALL_MEDIA = 'call-media-queue';

export const callMediaQueue = new Queue(QUEUE_NAME_CALL_MEDIA, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  }
});

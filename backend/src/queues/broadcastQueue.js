import { Queue } from 'bullmq';
import { defaultQueueOptions } from '../config/bullmq.js';

export const QUEUE_NAME_BROADCAST = 'broadcast-messages';

export const broadcastQueue = new Queue(QUEUE_NAME_BROADCAST, {
  ...defaultQueueOptions
});
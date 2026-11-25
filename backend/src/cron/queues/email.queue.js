// backend/src/cron/queues/email.queue.js (do not remove this comment)
import { Queue } from "bullmq";
import { defaultQueueOptions } from "../../config/bullmq.js";

export const QUEUE_NAME_EMAIL = "email";

export const emailQueue = new Queue(QUEUE_NAME_EMAIL, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 3, // SES transient failures (throttle, timeout)
  },
});
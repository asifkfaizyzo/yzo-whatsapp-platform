// backend/src/cron/workers/email.worker.js (do not remove this comment)
import { Worker } from "bullmq";
import { QUEUE_NAME_EMAIL } from "../queues/email.queue.js";
import { redisConnection } from "../../config/redis.js";
import { sendEmail } from "../../modules/email/email.service.js";
import { dlqQueue } from "../queues/dlq.queue.js";

const processEmailJob = async (job) => {
  const { to, subject, html, category, tenantId, fromName, attachments, metadata } = job.data;

  await sendEmail({
    to,
    subject,
    html,
    category,
    tenantId,
    fromName,
    attachments,
    metadata,
  });
};

export const startEmailWorker = () => {
  const worker = new Worker(QUEUE_NAME_EMAIL, processEmailJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[EmailWorker] Job ${job.id} sent to ${job.data.to}`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);

    if (job && job.attemptsMade >= job.opts.attempts) {
      try {
        await dlqQueue.add(
          "failed-email",
          {
            originalJobId: job.id,
            originalJobName: job.name,
            originalData: job.data,
            failedAt: new Date().toISOString(),
            attempts: job.attemptsMade,
            errorMessage: err.message,
            errorStack: err.stack,
            errorName: err.name,
            originalQueue: QUEUE_NAME_EMAIL,
          },
          { jobId: `dlq_email_${job.id}_${Date.now()}` },
        );
        console.warn(`[DLQ] Email job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
      } catch (dlqError) {
        console.error(`[DLQ] Failed to push email to DLQ:`, dlqError.message);
      }
    }
  });

  console.log("[EmailWorker] Started with DLQ support (concurrency: 5)");
  return worker;
};
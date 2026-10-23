import cron from 'node-cron';
import prisma from '../config/prisma.js';

export const startWebhookEventsCleanupJob = () => {
  // Runs daily at 03:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[WebhookCleanup] Starting scheduled 7-day retention cleanup...');
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.webhookEvent.deleteMany({
        where: {
          OR: [
            { processedAt: { lt: sevenDaysAgo } },
            { createdAt: { lt: sevenDaysAgo } },
          ],
        },
      });

      console.log(`[WebhookCleanup] Removed ${result.count} webhook events older than 7 days.`);
    } catch (err) {
      console.error('[WebhookCleanup] Webhook cleanup failed:', err.message);
    }
  });

  console.log('[WebhookCleanup] Job scheduled — runs daily at 3:00 AM (7-day retention)');
};

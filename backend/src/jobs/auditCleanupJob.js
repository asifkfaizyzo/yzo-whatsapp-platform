import cron from 'node-cron';
import { cleanupOldAuditLogsService } from '../modules/audit/auditLogService.js';

export const startAuditCleanupJob = () => {

  // Runs every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[AuditCleanup] Starting scheduled cleanup...');

    try {
      const result = await cleanupOldAuditLogsService();
      console.log(`[AuditCleanup] Done. Removed ${result.deletedCount} old logs.`);
    } catch (error) {
      console.error('[AuditCleanup] Cleanup failed:', error.message);
    }
  });

  console.log('[AuditCleanup] Job scheduled — runs daily at 2:00 AM');
};
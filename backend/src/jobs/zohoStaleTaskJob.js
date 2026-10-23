// src/jobs/zohoStaleTaskJob.js

import cron from 'node-cron';
import { scanAndCreateStaleTasks } from '../modules/zoho/zohoTaskService.js';

export const startZohoStaleTaskJob = () => {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('🕐 [ZohoTaskJob] Scanning for stale conversations...');
    try {
      await scanAndCreateStaleTasks();
      console.log('✅ [ZohoTaskJob] Stale task scan completed');
    } catch (err) {
      console.error('❌ [ZohoTaskJob] Scan failed:', err.message);
    }
  });

  console.log('🕐 [ZohoTaskJob] Scheduled — runs every 6 hours');
};
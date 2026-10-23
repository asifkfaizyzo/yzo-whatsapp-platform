// src/jobs/zohoWatchRenewalJob.js

import cron from 'node-cron';
import prisma from '../config/prisma.js';
import { subscribeToZohoNotifications } from '../modules/zoho/zohoService.js';
import { hasZohoFeature } from '../modules/zoho/zohoPlanService.js';

export const startZohoWatchRenewalJob = () => {
  // Run every 12 hours (at 00:30 and 12:30)
  cron.schedule('30 */12 * * *', async () => {
    console.log('🔄 [ZohoWatchJob] Starting automated webhook subscription renewals...');

    try {
      const connectedTenants = await prisma.tenant.findMany({
        where: { zohoConnectionStatus: 'CONNECTED' },
        select: { id: true, tenantName: true },
      });

      for (const tenant of connectedTenants) {
        const canWatch = await hasZohoFeature(tenant.id, 'webhooks');
        if (!canWatch) continue;

        try {
          await subscribeToZohoNotifications(tenant.id);
          console.log(`✅ [ZohoWatchJob] Renewed watch subscription for tenant ${tenant.id}`);
        } catch (err) {
          console.warn(`⚠️ [ZohoWatchJob] Renewal skipped/failed for tenant ${tenant.id}:`, err.message);
        }
      }

      console.log(`✅ [ZohoWatchJob] Renewal pass completed for ${connectedTenants.length} tenants`);
    } catch (err) {
      console.error('❌ [ZohoWatchJob] Job execution failed:', err.message);
    }
  });

  console.log('🔄 [ZohoWatchJob] Scheduled — runs every 12 hours for subscription renewals');
};
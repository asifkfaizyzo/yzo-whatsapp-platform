// src/jobs/shopifyReorderReminderJob.js

import prisma from '../config/prisma.js';
import { orderWebhookQueue } from '../queues/orderWebhookQueue.js';

/**
 * Runs daily. Finds Shopify orders delivered N days ago and enqueues
 * reorder reminder messages for each.
 */
export const runShopifyReorderReminders = async () => {
  console.log('\n🔄 [ReorderReminder] Starting daily reorder scan...');

  try {
    // 1. Get all tenants with Shopify connected + reorder enabled
    const shopifyTenants = await prisma.shopifyConnection.findMany({
      where: {
        status: 'active',
        postPurchaseReorderEnabled: true
      },
      select: {
        tenantId: true,
        postPurchaseReorderDays: true
      }
    });

    if (shopifyTenants.length === 0) {
      console.log('⏭️ [ReorderReminder] No tenants with reorder enabled.');
      return;
    }

    let totalEnqueued = 0;

    for (const config of shopifyTenants) {
      const { tenantId, postPurchaseReorderDays } = config;
      const days = postPurchaseReorderDays || 30;

      // 2. Calculate the target date window (±1 day to catch edge cases)
      const targetDateStart = new Date();
      targetDateStart.setDate(targetDateStart.getDate() - days - 1);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date();
      targetDateEnd.setDate(targetDateEnd.getDate() - days + 1);
      targetDateEnd.setHours(23, 59, 59, 999);

      // 3. Find delivered orders in that window that haven't been reminded
      const eligibleOrders = await prisma.ecommerceOrder.findMany({
        where: {
          tenantId,
          source: 'SHOPIFY',
          status: { in: ['completed', 'delivered'] },
          deliveredAt: {
            gte: targetDateStart,
            lte: targetDateEnd
          },
           reorderReminderSentAt: null,
          customerPhone: { not:'' }
        },
        take: 50 // Batch limit per tenant per run
      });

      for (const order of eligibleOrders) {
        if (!order.customerPhone || order.customerPhone === '+') continue;

        await orderWebhookQueue.add(
          'shopify-reorder-reminder',
          {
            tenantId,
            ecommerceOrderId: order.id,
            orderNumber: order.orderNumber,
            customerPhone: order.customerPhone,
            customerName: order.customerName,
            lineItems: order.lineItems
          },
          { delay: 0 } // Send immediately
        );

        totalEnqueued++;
      }
    }

    console.log(`✅ [ReorderReminder] Enqueued ${totalEnqueued} reorder reminders.`);
  } catch (err) {
    console.error('❌ [ReorderReminder] Error:', err.message);
  }
};
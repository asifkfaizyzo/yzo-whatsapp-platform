// src/jobs/shopifyWinBackJob.js

import prisma from '../config/prisma.js';
import { orderWebhookQueue } from '../queues/orderWebhookQueue.js';

/**
 * Runs daily. Finds inactive Shopify customers and enqueues win-back messages.
 */
export const runShopifyWinBackCampaign = async () => {
  console.log('\n💜 [WinBack] Starting daily win-back scan...');

  try {
    const shopifyTenants = await prisma.shopifyConnection.findMany({
      where: {
        status: 'active',
        postPurchaseWinBackEnabled: true
      },
      select: {
        tenantId: true,
        postPurchaseWinBackDays: true
      }
    });

    if (shopifyTenants.length === 0) {
      console.log('⏭️ [WinBack] No tenants with win-back enabled.');
      return;
    }

    let totalEnqueued = 0;

    for (const config of shopifyTenants) {
      const { tenantId, postPurchaseWinBackDays } = config;
      const days = postPurchaseWinBackDays || 90;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Find customers whose most recent Shopify order is older than cutoff
      // and who haven't received a win-back message recently
      const inactiveCustomers = await prisma.ecommerceOrder.findMany({
          where: {
          tenantId,
          source: 'SHOPIFY',
          customerPhone: { not: '' },
          createdAt: { lt: cutoffDate },
          OR: [
            { winBackSentAt: null },
            { winBackSentAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
          ]
        },
        select: {
          id: true,
          customerPhone: true,
          customerName: true,
          customerEmail: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      // Deduplicate by customerPhone (keep only the most recent order per customer)
      const seenPhones = new Set();
      const uniqueCustomers = [];

      for (const order of inactiveCustomers) {
        if (!order.customerPhone || order.customerPhone === '+') continue;
        if (seenPhones.has(order.customerPhone)) continue;

        // Verify this customer has NO orders after the cutoff
        const recentOrder = await prisma.ecommerceOrder.findFirst({
          where: {
            tenantId,
            source: 'SHOPIFY',
            customerPhone: order.customerPhone,
            createdAt: { gte: cutoffDate }
          }
        });

        if (recentOrder) continue; // Customer is active, skip

        seenPhones.add(order.customerPhone);
        uniqueCustomers.push(order);
      }

      for (const customer of uniqueCustomers) {
        await orderWebhookQueue.add(
          'shopify-win-back',
          {
            tenantId,
            ecommerceOrderId: customer.id,
            customerPhone: customer.customerPhone,
            customerName: customer.customerName || 'Customer'
          },
          { delay: 0 }
        );

        totalEnqueued++;
      }
    }

    console.log(`✅ [WinBack] Enqueued ${totalEnqueued} win-back messages.`);
  } catch (err) {
    console.error('❌ [WinBack] Error:', err.message);
  }
};
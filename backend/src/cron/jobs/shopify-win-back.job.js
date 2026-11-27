// backend/src/cron/jobs/shopifyWinBackJob.js (do not remove this comment)

import prisma from "../../config/prisma.js";
import { orderWebhookQueue } from "../queues/order-webhook.queue.js";

const canScheduleShopifyOrderReminder = async ({ tenantId, storeId, shopifyCustomerId }) => {
  try {
    const store = await prisma.shopifyStore.findFirst({
      where: { id: storeId, tenantId, status: "active", redactedAt: null },
      select: { id: true, tenantId: true, status: true, redactedAt: true },
    });
    if (
      !store || store.id !== storeId || store.tenantId !== tenantId ||
      store.status !== "active" || store.redactedAt !== null
    ) return false;

    if (shopifyCustomerId == null) return true;
    const tombstone = await prisma.shopifyCustomerRedaction.findUnique({
      where: {
        storeId_shopifyCustomerId: {
          storeId,
          shopifyCustomerId: String(shopifyCustomerId),
        },
      },
      select: { id: true },
    });
    return !tombstone;
  } catch {
    return false;
  }
};

/**
 * Runs daily. Finds inactive Shopify customers and enqueues win-back messages.
 */
export const runShopifyWinBackCampaign = async () => {
  console.log("\n💜 [WinBack] Starting daily win-back scan...");

  try {
    const shopifyTenants = await prisma.shopifyConnection.findMany({
      where: {
        status: "active",
        postPurchaseWinBackEnabled: true,
      },
      select: {
        tenantId: true,
        postPurchaseWinBackDays: true,
        store: {
          select: {
            id: true,
            tenantId: true,
            status: true,
            redactedAt: true,
          },
        },
      },
    });

    if (shopifyTenants.length === 0) {
      console.log("⏭️ [WinBack] No tenants with win-back enabled.");
      return;
    }

    let totalEnqueued = 0;

    for (const config of shopifyTenants) {
            const {
        tenantId,
        postPurchaseWinBackDays,
        store,
      } = config;

      const storeId = store?.id;

      if (
        !store ||
        !storeId ||
        store.tenantId !== tenantId ||
        store.status !== "active" ||
        store.redactedAt
      ) {
        console.warn(
          `[WinBack] Skipping tenant ${tenantId}: no active Shopify store.`,
        );
        continue;
      }

      const days = postPurchaseWinBackDays || 90;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Find customers whose most recent Shopify order is older than cutoff
      // and who haven't received a win-back message recently
      const inactiveCustomers = await prisma.ecommerceOrder.findMany({
        where: {
          tenantId,
          source: "SHOPIFY",
          shopifyStoreId: storeId,
          customerPhone: { not: "" },
          createdAt: { lt: cutoffDate },
          OR: [
            { winBackSentAt: null },
            {
              winBackSentAt: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
        select: {
          id: true,
          customerPhone: true,
          customerName: true,
          customerEmail: true,
          shopifyCustomerId: true,
          createdAt: true,
          shopifyStoreId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      // Deduplicate by customerPhone (keep only the most recent order per customer)
      const seenPhones = new Set();
      const uniqueCustomers = [];

      for (const order of inactiveCustomers) {
        if (order.shopifyStoreId !== storeId) continue;
        if (!order.customerPhone || order.customerPhone === "+") continue;
        if (seenPhones.has(order.customerPhone)) continue;

        // Verify this customer has NO orders after the cutoff
        const recentOrder = await prisma.ecommerceOrder.findFirst({
          where: {
            tenantId,
            source: "SHOPIFY",
            shopifyStoreId: storeId,
            customerPhone: order.customerPhone,
            createdAt: { gte: cutoffDate },
          },
        });

        if (recentOrder) continue; // Customer is active, skip

        seenPhones.add(order.customerPhone);
        uniqueCustomers.push(order);
      }

      for (const customer of uniqueCustomers) {
        const canSchedule = await canScheduleShopifyOrderReminder({
          tenantId,
          storeId,
          shopifyCustomerId: customer.shopifyCustomerId,
        });
        if (!canSchedule) continue;

        await orderWebhookQueue.add(
          "shopify-win-back",
          {
            tenantId,
            storeId,
            ecommerceOrderId: customer.id,
            customerPhone: customer.customerPhone,
            customerName: customer.customerName || "Customer",
          },
          { delay: 0 },
        );

        totalEnqueued++;
      }
    }

    console.log(`✅ [WinBack] Enqueued ${totalEnqueued} win-back messages.`);
  } catch (err) {
    console.error("❌ [WinBack] Error:", err.message);
  }
};

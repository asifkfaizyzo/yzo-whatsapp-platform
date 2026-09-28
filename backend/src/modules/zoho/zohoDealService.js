// src/modules/zoho/zohoDealService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';

/**
 * Create a Deal in Zoho CRM when a WhatsApp order is placed.
 * Called from webhook worker when messageType === 'order'.
 * Non-blocking — failures are silently logged.
 */
export async function createZohoDealFromOrder(tenantId, order, contact) {
  try {
    const canCreate = await hasZohoFeature(tenantId, 'deals');
    if (!canCreate) {
      console.log(`ℹ️ [ZohoDeal] Deals not available on this Zoho plan. Skipping.`);
      return;
    }

    // Find Zoho contact mapping
    const mapping = await prisma.contactProviderMapping.findUnique({
      where: {
        contactId_provider: {
          contactId: contact.id,
          provider: 'ZOHO',
        },
      },
    });

    if (!mapping) {
      console.log(`ℹ️ [ZohoDeal] Contact ${contact.id} not synced to Zoho. Skipping deal creation.`);
      return;
    }

    const dealName = `WhatsApp Order #${order.orderNumber}`;
    const amount = Number(order.totalAmount) || 0;

    const dealPayload = {
      Deal_Name: dealName,
      Amount: amount,
      Stage: 'Qualification',
      Contact_Name: mapping.providerContactId,
      Lead_Source: 'WhatsApp',
      Description: buildDealDescription(order),
      Closing_Date: getClosingDate(7), // 7 days from now
    };

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Deals',
      data: {
        data: [dealPayload],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS' && result.details?.id) {
      console.log(`💰 [ZohoDeal] Created Deal "${dealName}" (${result.details.id}) for order ${order.orderNumber}`);

      // Store mapping for future updates (e.g., when payment confirmed → move stage)
      await prisma.contactProviderMapping.upsert({
        where: {
          contactId_provider: {
            contactId: contact.id,
            provider: 'ZOHO_DEAL',
          },
        },
        update: {
          providerContactId: result.details.id,
          lastSyncedAt: new Date(),
          metadata: { orderNumber: order.orderNumber, orderId: order.id },
        },
        create: {
          tenantId,
          contactId: contact.id,
          provider: 'ZOHO_DEAL',
          providerContactId: result.details.id,
          lastSyncedAt: new Date(),
          metadata: { orderNumber: order.orderNumber, orderId: order.id },
        },
      });
    } else {
      console.warn(`⚠️ [ZohoDeal] Failed to create deal:`, result?.message);
    }
  } catch (error) {
    console.error(`❌ [ZohoDeal] Failed for order ${order.orderNumber}:`, error.response?.data || error.message);
  }
}

/**
 * Update Deal stage when payment status changes
 */
export async function updateZohoDealStage(tenantId, orderId, paymentStatus) {
  try {
    const canUpdate = await hasZohoFeature(tenantId, 'deals');
    if (!canUpdate) return;

    const mapping = await prisma.contactProviderMapping.findFirst({
      where: {
        tenantId,
        provider: 'ZOHO_DEAL',
        metadata: { path: ['orderId'], equals: orderId },
      },
    });

    if (!mapping) return;

    const stageMap = {
      PAID: 'Closed Won',
      UNPAID: 'Qualification',
      FAILED: 'Closed Lost',
      REFUNDED: 'Closed Lost',
      CANCELLED: 'Closed Lost',
      EXPIRED: 'Closed Lost',
    };

    const newStage = stageMap[paymentStatus];
    if (!newStage) return;

    await zohoRequest(tenantId, {
      method: 'PUT',
      url: `/crm/v7/Deals/${mapping.providerContactId}`,
      data: {
        data: [{ Stage: newStage }],
      },
    });

    console.log(`💰 [ZohoDeal] Updated Deal ${mapping.providerContactId} stage to "${newStage}"`);
  } catch (error) {
    console.error(`❌ [ZohoDeal] Stage update failed:`, error.message);
  }
}

function buildDealDescription(order) {
  let desc = `Order placed via WhatsApp on ${new Date().toLocaleDateString('en-IN')}\n\n`;
  desc += `Order Number: ${order.orderNumber}\n`;
  desc += `Total Amount: ${order.currency || 'INR'} ${Number(order.totalAmount).toFixed(2)}\n`;
  if (order.customerNote) desc += `Customer Note: ${order.customerNote}\n`;
  if (order.items && order.items.length > 0) {
    desc += `\nItems:\n`;
    for (const item of order.items) {
      desc += `• ${item.productName || item.productRetailerId} x${item.quantity} — ${item.currency} ${Number(item.itemPrice).toFixed(2)}\n`;
    }
  }
  return desc.substring(0, 5000);
}

function getClosingDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
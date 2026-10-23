// src/modules/zoho/zohoDealService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';
import { getTenantZohoPreferences } from './zohoContactService.js';
import { redisConnection } from '../../config/redis.js';

const SYNC_LOCK_TTL = 30;

/**
 * Create a Deal in Zoho CRM when a WhatsApp order is placed.
 */
export async function createZohoDealFromOrder(tenantId, order, contact) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zohoConnectionStatus: true },
    });

    if (!tenant || tenant.zohoConnectionStatus !== 'CONNECTED') {
      return;
    }

    const prefs = await getTenantZohoPreferences(tenantId);
    if (!prefs.createDealsOnOrders) return;

    const canCreate = await hasZohoFeature(tenantId, 'deals');
    if (!canCreate) return;

    const mapping = await prisma.contactProviderMapping.findFirst({
      where: {
        contactId: contact.id,
        provider: { in: ['ZOHO', 'ZOHO_LEAD'] },
      },
    });

    if (!mapping) return;

    const dealName = `WhatsApp Order #${order.orderNumber}`;
    const amount = Number(order.totalAmount) || 0;

    const dealPayload = {
      Deal_Name: dealName,
      Amount: amount,
      Stage: 'Qualification',
      Lead_Source: 'WhatsApp',
      Description: buildDealDescription(order),
      Closing_Date: getClosingDate(7),
    };

    if (mapping.provider === 'ZOHO_LEAD') {
      dealPayload.Contact_Name = mapping.providerContactId;
    } else {
      dealPayload.Contact_Name = mapping.providerContactId;
    }

    // Lock key for deals
    const lockKeyDeal = `zoho_sync_lock_deal:${order.id}`;
    await redisConnection.set(lockKeyDeal, '1', 'EX', SYNC_LOCK_TTL);

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Deals',
      data: {
        data: [dealPayload],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS' && result.details?.id) {
      console.log(`💰 [ZohoDeal] Created Deal "${dealName}" (${result.details.id})`);

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
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zohoConnectionStatus: true },
    });

    if (!tenant || tenant.zohoConnectionStatus !== 'CONNECTED') {
      return;
    }

    const prefs = await getTenantZohoPreferences(tenantId);
    if (!prefs.createDealsOnOrders) return;

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
      PROCESSING: 'Negotiation',
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

    console.log(`💰 [ZohoDeal] Updated Deal stage to "${newStage}" for order ${orderId}`);
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
  return d.toISOString().split('T')[0];
}
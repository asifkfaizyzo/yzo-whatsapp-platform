// src/modules/zoho/zohoWebhookService.js

import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';

/**
 * Process inbound Zoho CRM webhook notification.
 * Zoho sends POST requests when subscribed CRM records change.
 */
export async function processZohoWebhookEvent(body) {
  try {
    const notifications = body?.notifications || [];

    for (const notification of notifications) {
      const channelId = notification.channel_id;
      const module = notification.module;
      const operation = notification.operation; // "insert", "update", "delete"
      const recordId = notification.ids?.[0];
      const token = notification.token; // This is the tenantId we set during subscription

      if (!token || !recordId) {
        console.warn('⚠️ [ZohoWebhook] Missing token or record ID in notification');
        continue;
      }

      // Resolve tenant from the channel token
      const tenant = await prisma.tenant.findFirst({
        where: {
          id: token,
          zohoConnectionStatus: 'CONNECTED',
        },
        select: { id: true, tenantName: true },
      });

      if (!tenant) {
        console.warn(`⚠️ [ZohoWebhook] No active tenant found for token: ${token}`);
        continue;
      }

      // Only process Contact module events for now
      if (module !== 'Contacts') {
        console.log(`ℹ️ [ZohoWebhook] Ignoring non-Contact module event: ${module}`);
        continue;
      }

      // Find the Sudo Reply contact mapped to this Zoho record
      const mapping = await prisma.contactProviderMapping.findUnique({
        where: {
          tenantId_provider_providerContactId: {
            tenantId: tenant.id,
            provider: 'ZOHO',
            providerContactId: recordId,
          },
        },
        include: {
          contact: { select: { id: true, name: true, phone: true } },
        },
      });

      if (!mapping) {
        console.log(`ℹ️ [ZohoWebhook] No mapping found for Zoho contact ${recordId} in tenant ${tenant.id}`);
        continue;
      }

      console.log(`📥 [ZohoWebhook] Zoho Contact ${operation} event for ${mapping.contact.name} (Zoho ID: ${recordId})`);

      // Notify tenant about the external change
      const actionLabel = operation === 'insert' ? 'created in' : operation === 'update' ? 'updated in' : 'deleted from';

      await createNotification({
        tenantId: tenant.id,
        userId: null,
        type: 'zoho_contact_changed',
        title: `Zoho CRM Contact ${operation === 'insert' ? 'Created' : operation === 'update' ? 'Updated' : 'Deleted'}`,
        message: `Contact "${mapping.contact.name}" was ${actionLabel} Zoho CRM.`,
        metadata: {
          contactId: mapping.contact.id,
          zohoContactId: recordId,
          operation,
        },
      });

      emitToTenant(tenant.id, 'zoho_contact_changed', {
        contactId: mapping.contact.id,
        zohoContactId: recordId,
        operation,
        contactName: mapping.contact.name,
      });

      // If deleted in Zoho, optionally mark the mapping as stale
      if (operation === 'delete') {
        await prisma.contactProviderMapping.delete({
          where: { id: mapping.id },
        });
        console.log(`🗑️ [ZohoWebhook] Removed stale mapping for deleted Zoho contact ${recordId}`);
      }
    }

    return { status: 'ok' };
  } catch (error) {
    console.error('❌ [ZohoWebhook] Processing error:', error);
    throw error;
  }
}
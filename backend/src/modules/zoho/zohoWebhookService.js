// src/modules/zoho/zohoWebhookService.js

import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';

/**
 * Process inbound Zoho CRM webhook notification.
 */
export async function processZohoWebhookEvent(body) {
  try {
    const notifications = body?.notifications || [];

    for (const notification of notifications) {
      const module = notification.module;
      const operation = notification.operation;
      const recordId = notification.ids?.[0];
      const token = notification.token;

      if (!token || !recordId) continue;

      const tenant = await prisma.tenant.findFirst({
        where: { id: token, zohoConnectionStatus: 'CONNECTED' },
        select: { id: true, tenantName: true },
      });

      if (!tenant) continue;

      if (module !== 'Contacts') continue;

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

      if (!mapping) continue;

      console.log(`📥 [ZohoWebhook] ${operation} event for ${mapping.contact.name} (Zoho: ${recordId})`);

      if (operation === 'delete') {
        await prisma.contactProviderMapping.delete({ where: { id: mapping.id } });
        console.log(`🗑️ [ZohoWebhook] Removed mapping for deleted Zoho contact ${recordId}`);
      }

      // Notify tenant
      const actionLabel = operation === 'insert' ? 'created in' : operation === 'update' ? 'updated in' : 'deleted from';

      await createNotification({
        tenantId: tenant.id,
        userId: null,
        type: 'zoho_contact_changed',
        title: `Zoho Contact ${operation === 'insert' ? 'Created' : operation === 'update' ? 'Updated' : 'Deleted'}`,
        message: `Contact "${mapping.contact.name}" was ${actionLabel} Zoho CRM.`,
        metadata: { contactId: mapping.contact.id, zohoContactId: recordId, operation },
      });

      emitToTenant(tenant.id, 'zoho_contact_changed', {
        contactId: mapping.contact.id,
        zohoContactId: recordId,
        operation,
        contactName: mapping.contact.name,
      });
    }

    return { status: 'ok' };
  } catch (error) {
    console.error('❌ [ZohoWebhook] Processing error:', error);
    throw error;
  }
}
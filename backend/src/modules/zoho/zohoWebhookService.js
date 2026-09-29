// src/modules/zoho/zohoWebhookService.js

import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';
import { zohoRequest } from './zohoClient.js';
import { redisConnection } from '../../config/redis.js';

const SYNC_LOCK_TTL = 30; // 30 seconds loop-prevention window

/**
 * Process inbound Zoho CRM webhook notification with loop prevention.
 */
export async function processZohoWebhookEvent(body) {
  try {
    const notifications = body?.notifications || [];

    for (const notification of notifications) {
      const module = notification.module;
      const operation = notification.operation; // "insert", "update", "delete"
      const recordId = notification.ids?.[0];
      const token = notification.token; // Tenant ID

      if (!token || !recordId) continue;

      const tenant = await prisma.tenant.findFirst({
        where: { id: token, zohoConnectionStatus: 'CONNECTED' },
        select: { id: true, tenantName: true },
      });

      if (!tenant) continue;

      // Handle Contact & Lead module events
      if (module !== 'Contacts' && module !== 'Leads') continue;

      const providerType = module === 'Leads' ? 'ZOHO_LEAD' : 'ZOHO';

      const mapping = await prisma.contactProviderMapping.findUnique({
        where: {
          tenantId_provider_providerContactId: {
            tenantId: tenant.id,
            provider: providerType,
            providerContactId: recordId,
          },
        },
        include: {
          contact: true,
        },
      });

      // ── Handle Record Deletion in Zoho ──
      if (operation === 'delete') {
        if (mapping) {
          await prisma.contactProviderMapping.delete({ where: { id: mapping.id } });
          console.log(`🗑️ [ZohoWebhook] Removed mapping for deleted Zoho ${module} record ${recordId}`);

          emitToTenant(tenant.id, 'zoho_contact_changed', {
            contactId: mapping.contactId,
            zohoRecordId: recordId,
            operation: 'delete',
            module,
          });
        }
        continue;
      }

      // ── Handle Insert / Update from Zoho ──
      if (operation === 'update' || operation === 'insert') {
        // Loop prevention: check if this update was initiated by Sudo Reply
        const lockKey = `zoho_sync_lock:${mapping?.contactId || recordId}`;
        const isLocked = await redisConnection.get(lockKey);
        if (isLocked) {
          console.log(`🔒 [ZohoWebhook] Ignoring echoed update for contact (loop prevention active)`);
          continue;
        }

        // Fetch fresh record details from Zoho CRM
        let zohoRecord = null;
        try {
          const res = await zohoRequest(tenant.id, {
            method: 'GET',
            url: `/crm/v7/${module}/${recordId}`,
          });
          zohoRecord = res?.data?.[0];
        } catch (fetchErr) {
          console.warn(`⚠️ [ZohoWebhook] Failed to fetch updated ${module} record ${recordId}:`, fetchErr.message);
          continue;
        }

        if (!zohoRecord) continue;

        const fullName = `${zohoRecord.First_Name || ''} ${zohoRecord.Last_Name || ''}`.trim() || zohoRecord.Full_Name || 'Zoho Contact';
        const phone = zohoRecord.Phone || zohoRecord.Mobile || null;
        const email = zohoRecord.Email || null;
        const company = zohoRecord.Company || zohoRecord.Account_Name?.name || null;

        if (mapping && mapping.contact) {
          // Set lock so Sudo Reply's updateContact hook doesn't push back to Zoho
          await redisConnection.set(lockKey, '1', 'EX', SYNC_LOCK_TTL);

          // Update existing contact in Sudo Reply
          const updatedContact = await prisma.contact.update({
            where: { id: mapping.contact.id },
            data: {
              name: fullName || mapping.contact.name,
              email: email || mapping.contact.email,
              company: company || mapping.contact.company,
              ...(phone && !mapping.contact.phone ? { phone, whatsappId: phone.replace(/\D/g, '').slice(-10) } : {}),
            },
          });

          await prisma.contactProviderMapping.update({
            where: { id: mapping.id },
            data: { lastSyncedAt: new Date() },
          });

          console.log(`📥 [ZohoWebhook] Synced changes from Zoho to Sudo Reply Contact: "${updatedContact.name}"`);

          emitToTenant(tenant.id, 'contact_updated', {
            contact: updatedContact,
            source: 'ZOHO_CRM',
          });

          await createNotification({
            tenantId: tenant.id,
            userId: null,
            type: 'zoho_contact_changed',
            title: `Zoho CRM ${module} Updated`,
            message: `Contact "${updatedContact.name}" was updated from Zoho CRM.`,
            metadata: { contactId: updatedContact.id, zohoRecordId: recordId, operation },
          });
        }
      }
    }

    return { status: 'ok' };
  } catch (error) {
    console.error('❌ [ZohoWebhook] Processing error:', error);
    throw error;
  }
}
// src/modules/zoho/zohoWebhookService.js

import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';
import { zohoRequest } from './zohoClient.js';
import { redisConnection } from '../../config/redis.js';

const SYNC_LOCK_TTL = 30;

/**
 * Process inbound Zoho CRM webhook notification with robust loop prevention and match-by-phone fallback.
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

      if (module !== 'Contacts' && module !== 'Leads') continue;

      const providerType = module === 'Leads' ? 'ZOHO_LEAD' : 'ZOHO';

      let mapping = await prisma.contactProviderMapping.findUnique({
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
        const rawPhone = zohoRecord.Phone || zohoRecord.Mobile || null;
        const email = zohoRecord.Email || null;
        const company = zohoRecord.Company || zohoRecord.Account_Name?.name || null;

        // Clean and normalize phone number for comparison
        let cleanPhone = null;
        if (rawPhone) {
          const digits = rawPhone.replace(/\D/g, '');
          if (digits.length >= 8 && digits.length <= 15) {
            cleanPhone = `+${digits}`;
          }
        }

        // 🎯 FALLBACK: If no mapping exists, attempt matching by phone to resolve links
        if (!mapping && cleanPhone) {
          const matchedContact = await prisma.contact.findFirst({
            where: {
              phone: cleanPhone,
              tenantId: tenant.id,
            },
          });

          if (matchedContact) {
            console.log(`🔗 [ZohoWebhook] Matching Zoho ${module} ${recordId} on-the-fly to Contact "${matchedContact.name}"`);
            mapping = await prisma.contactProviderMapping.create({
              data: {
                tenantId: tenant.id,
                contactId: matchedContact.id,
                provider: providerType,
                providerContactId: recordId,
                lastSyncedAt: new Date(),
              },
              include: {
                contact: true,
              },
            });
          }
        }

        if (mapping && mapping.contact) {
          // Loop prevention check on BOTH contact ID and Zoho record ID
          const lockKeyContact = `zoho_sync_lock:${mapping.contactId}`;
          const lockKeyRecord = `zoho_sync_lock:${recordId}`;

          const isLockedContact = await redisConnection.get(lockKeyContact);
          const isLockedRecord = await redisConnection.get(lockKeyRecord);

          if (isLockedContact || isLockedRecord) {
            console.log(`🔒 [ZohoWebhook] Ignoring echoed update for contact ${mapping.contactId} (prevention locks active)`);
            continue;
          }

          // Apply temporary locks to suppress loops on Sudo Reply local updates
          await redisConnection.set(lockKeyContact, '1', 'EX', SYNC_LOCK_TTL);
          await redisConnection.set(lockKeyRecord, '1', 'EX', SYNC_LOCK_TTL);

          const updatedContact = await prisma.contact.update({
            where: { id: mapping.contact.id },
            data: {
              name: fullName || mapping.contact.name,
              email: email || mapping.contact.email,
              company: company || mapping.contact.company,
              ...(cleanPhone && !mapping.contact.phone ? { phone: cleanPhone, whatsappId: cleanPhone.replace(/\D/g, '').slice(-10) } : {}),
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
// src/modules/zoho/zohoWebhookService.js

import prisma from '../../config/prisma.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';
import { zohoRequest } from './zohoClient.js';
import { redisConnection } from '../../config/redis.js';

const SYNC_LOCK_TTL = 30; // 30 seconds loop-prevention window

/**
 * Normalizes phone numbers from Zoho (e.g., "08086415357" -> "+918086415357")
 */
function normalizeZohoPhone(rawPhone, defaultCountryCode = '+91') {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  // 10 digits (e.g. 8086415357) -> +918086415357
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  // 11 digits starting with 0 (e.g. 08086415357) -> +918086415357
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }
  // 12 digits starting with 91 (e.g. 918086415357) -> +918086415357
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

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
        // Loop prevention: check if this update was initiated by Sudo Reply
        const lockKeyRecord = `zoho_sync_lock:${recordId}`;
        const isLockedRecord = await redisConnection.get(lockKeyRecord);
        if (isLockedRecord) {
          console.log(`🔒 [ZohoWebhook] Ignoring echoed update for record ${recordId} (loop prevention active)`);
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
        const rawPhone = zohoRecord.Phone || zohoRecord.Mobile || null;
        const normalizedPhone = normalizeZohoPhone(rawPhone);
        const email = zohoRecord.Email || null;
        const company = zohoRecord.Company || zohoRecord.Account_Name?.name || null;

        // ═══════════════════════════════════════════════════
        // CASE 1: Contact is ALREADY Mapped in Sudo Reply
        // ═══════════════════════════════════════════════════
        if (mapping && mapping.contact) {
          const lockKeyContact = `zoho_sync_lock:${mapping.contactId}`;
          const isLockedContact = await redisConnection.get(lockKeyContact);
          if (isLockedContact) continue;

          // Set loop prevention lock
          await redisConnection.set(lockKeyContact, '1', 'EX', SYNC_LOCK_TTL);
          await redisConnection.set(lockKeyRecord, '1', 'EX', SYNC_LOCK_TTL);

          const updatedContact = await prisma.contact.update({
            where: { id: mapping.contact.id },
            data: {
              name: fullName || mapping.contact.name,
              email: email || mapping.contact.email,
              company: company || mapping.contact.company,
              ...(normalizedPhone && !mapping.contact.phone
                ? { phone: normalizedPhone, whatsappId: normalizedPhone.replace(/\D/g, '').slice(-10) }
                : {}),
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

        // ═══════════════════════════════════════════════════
        // CASE 2: Brand NEW Contact Created in Zoho CRM
        // ═══════════════════════════════════════════════════
        } else {
          let contact = null;

          // A. Check if contact exists by phone first
          if (normalizedPhone) {
            contact = await prisma.contact.findFirst({
              where: {
                phone: normalizedPhone,
                tenantId: tenant.id,
              },
            });
          }

          // B. If not found, check by email
          if (!contact && email) {
            contact = await prisma.contact.findFirst({
              where: {
                email,
                tenantId: tenant.id,
              },
            });
          }

          // C. If still not found, CREATE brand new contact in Sudo Reply
          if (!contact) {
            const cleanDigits = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : '';
            contact = await prisma.contact.create({
              data: {
                tenantId: tenant.id,
                name: fullName,
                phone: normalizedPhone,
                email: email || null,
                company: company || null,
                whatsappId: cleanDigits ? cleanDigits.slice(-10) : null,
                channel: 'WHATSAPP',
              },
            });

            console.log(`🆕 [ZohoWebhook] Created NEW Contact in Sudo Reply from Zoho: "${fullName}" (${normalizedPhone || email})`);

            emitToTenant(tenant.id, 'new_contact', {
              contact,
              source: 'ZOHO_CRM',
            });

            await createNotification({
              tenantId: tenant.id,
              userId: null,
              type: 'zoho_contact_created',
              title: `New Zoho CRM ${module} Synced`,
              message: `Contact "${fullName}" was imported from Zoho CRM.`,
              metadata: { contactId: contact.id, zohoRecordId: recordId },
            });
          }

          // D. Save provider mapping so future edits stay linked
          if (contact) {
            // Apply loop prevention lock
            await redisConnection.set(`zoho_sync_lock:${contact.id}`, '1', 'EX', SYNC_LOCK_TTL);
            await redisConnection.set(lockKeyRecord, '1', 'EX', SYNC_LOCK_TTL);

            await prisma.contactProviderMapping.upsert({
              where: {
                tenantId_provider_providerContactId: {
                  tenantId: tenant.id,
                  provider: providerType,
                  providerContactId: recordId,
                },
              },
              update: {
                contactId: contact.id,
                lastSyncedAt: new Date(),
              },
              create: {
                tenantId: tenant.id,
                contactId: contact.id,
                provider: providerType,
                providerContactId: recordId,
                lastSyncedAt: new Date(),
              },
            });
            console.log(`🔗 [ZohoWebhook] Linked Zoho ${module} (${recordId}) ↔ Sudo Contact (${contact.id})`);
          }
        }
      }
    }

    return { status: 'ok' };
  } catch (error) {
    console.error('❌ [ZohoWebhook] Processing error:', error);
    throw error;
  }
}
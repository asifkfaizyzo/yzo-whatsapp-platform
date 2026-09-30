// src/modules/zoho/zohoLeadService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';
import { splitContactName, getTenantZohoPreferences } from './zohoContactService.js';
import { redisConnection } from '../../config/redis.js';

const SYNC_LOCK_TTL = 30;

/**
 * Create a Lead in Zoho CRM for a new WhatsApp contact.
 * Strictly respects active connection, preference settings, and lock mechanisms.
 */
export async function createZohoLead(tenantId, contact) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zohoConnectionStatus: true },
    });

    if (!tenant || tenant.zohoConnectionStatus !== 'CONNECTED') {
      return null;
    }

    // Check preference
    const prefs = await getTenantZohoPreferences(tenantId);
    if (!prefs.autoSyncNewContacts || prefs.syncDestination !== 'LEADS') {
      return null; // Sync disabled or routed to Contacts instead
    }

    const canCreate = await hasZohoFeature(tenantId, 'leads');
    if (!canCreate) return null;

    const existingMapping = await prisma.contactProviderMapping.findFirst({
      where: {
        contactId: contact.id,
        provider: { in: ['ZOHO', 'ZOHO_LEAD'] },
      },
    });

    if (existingMapping) {
      console.log(`ℹ️ [ZohoLead] Contact ${contact.id} already mapped to Zoho. Skipping lead creation.`);
      return existingMapping.providerContactId;
    }

    const { firstName, lastName } = splitContactName(contact.name);

    const leadPayload = {
      Last_Name: lastName,
      Lead_Status: 'New',
      Lead_Source: 'WhatsApp',
      Description: `WhatsApp lead captured via Sudo Reply on ${new Date().toLocaleDateString('en-IN')}. Channel: ${contact.channel || 'WHATSAPP'}`,
    };

    if (firstName) leadPayload.First_Name = firstName;
    if (contact.email) leadPayload.Email = contact.email;
    if (contact.phone) {
      leadPayload.Phone = contact.phone;
      leadPayload.Mobile = contact.phone;
    }
    if (contact.company) leadPayload.Company = contact.company;

    // Apply loop prevention lock in Redis
    const lockKeyContact = `zoho_sync_lock:${contact.id}`;
    await redisConnection.set(lockKeyContact, '1', 'EX', SYNC_LOCK_TTL);

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Leads',
      data: {
        data: [leadPayload],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS' && result.details?.id) {
      const zohoLeadId = result.details.id;

      // Lock newly generated lead ID as well
      const lockKeyLead = `zoho_sync_lock:${zohoLeadId}`;
      await redisConnection.set(lockKeyLead, '1', 'EX', SYNC_LOCK_TTL);

      await prisma.contactProviderMapping.upsert({
        where: {
          contactId_provider: {
            contactId: contact.id,
            provider: 'ZOHO_LEAD',
          },
        },
        update: {
          providerContactId: zohoLeadId,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          contactId: contact.id,
          provider: 'ZOHO_LEAD',
          providerContactId: zohoLeadId,
          lastSyncedAt: new Date(),
        },
      });

      console.log(`🎯 [ZohoLead] Created Lead "${contact.name}" (${zohoLeadId})`);
      return zohoLeadId;
    }

    return null;
  } catch (error) {
    console.error(`❌ [ZohoLead] Failed for contact ${contact.id}:`, error.response?.data || error.message);
    return null;
  }
}
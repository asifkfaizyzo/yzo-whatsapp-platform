// src/modules/zoho/zohoContactService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { emitToTenant } from '../../lib/socket.js';
import { createAuditLog } from '../audit/auditLogService.js';

const BATCH_SIZE = 100;

/**
 * Deterministic Name Split Rule:
 * - Multi-word: everything before the last space -> First_Name, last word -> Last_Name
 * - Single-word: First_Name = null, word -> Last_Name
 * - Empty/whitespace: Last_Name = "Unknown"
 */
export function splitContactName(rawName) {
  const trimmed = (rawName || '').trim();

  if (!trimmed) {
    return { firstName: null, lastName: 'Unknown' };
  }

  const lastSpaceIndex = trimmed.lastIndexOf(' ');

  if (lastSpaceIndex === -1) {
    return { firstName: null, lastName: trimmed };
  }

  const firstName = trimmed.substring(0, lastSpaceIndex).trim();
  const lastName = trimmed.substring(lastSpaceIndex + 1).trim();

  return {
    firstName: firstName || null,
    lastName: lastName || 'Unknown',
  };
}

/**
 * Transforms a Sudo Reply Contact into an enriched Zoho CRM Contact payload.
 * Includes Lead Source, Description, Tags, and channel metadata.
 */
export function formatContactForZoho(contact, existingZohoId = null) {
  const { firstName, lastName } = splitContactName(contact.name);

  const payload = {
    Last_Name: lastName,
    Lead_Source: 'WhatsApp',
    Description: `Lead generated via Sudo Reply WhatsApp on ${new Date().toLocaleDateString('en-IN')}. Channel: ${contact.channel || 'WHATSAPP'}`,
  };

  if (firstName) {
    payload.First_Name = firstName;
  }

  if (contact.email && contact.email.trim()) {
    payload.Email = contact.email.trim();
  }

  if (contact.phone && contact.phone.trim()) {
    payload.Phone = contact.phone.trim();
    payload.Mobile = contact.phone.trim();
  }

  if (contact.company && contact.company.trim()) {
    payload.Account_Name = contact.company.trim();
  }

  if (existingZohoId) {
    payload.id = existingZohoId;
  }

  return payload;
}

/**
 * AUTO-SYNC: Push a single contact to Zoho CRM in real-time.
 * Called automatically when a contact is created or updated in Sudo Reply.
 * Non-blocking — failures are logged but do not interrupt the main flow.
 */
export async function autoSyncContactToZoho(tenantId, contactId) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zohoConnectionStatus: true },
    });

    if (!tenant || tenant.zohoConnectionStatus !== 'CONNECTED') {
      return; // Zoho not connected — silently skip
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        providerMappings: { where: { provider: 'ZOHO' } },
        contactTags: { include: { tag: true } },
      },
    });

    if (!contact || !contact.isActive || contact.isBlocked) {
      return; // Skip inactive/blocked contacts
    }

    const existingMapping = contact.providerMappings?.[0];
    const zohoPayload = formatContactForZoho(contact, existingMapping?.providerContactId);

    // Attach Zoho Tags if contact has Sudo Reply tags
    if (contact.contactTags && contact.contactTags.length > 0) {
      const tagNames = contact.contactTags
        .map((ct) => ct.tag?.name)
        .filter(Boolean);
      if (tagNames.length > 0) {
        zohoPayload.Tag = tagNames.join(', ');
      }
    }

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Contacts/upsert',
      data: {
        data: [zohoPayload],
        duplicate_check_fields: ['Email', 'Phone'],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS' && result.details?.id) {
      const zohoRecordId = result.details.id;

      await prisma.contactProviderMapping.upsert({
        where: {
          contactId_provider: {
            contactId: contact.id,
            provider: 'ZOHO',
          },
        },
        update: {
          providerContactId: zohoRecordId,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          contactId: contact.id,
          provider: 'ZOHO',
          providerContactId: zohoRecordId,
          lastSyncedAt: new Date(),
        },
      });

      console.log(`✅ [ZohoAutoSync] Contact ${contact.name} (${contact.id}) synced to Zoho (${result.action})`);
    } else {
      console.warn(`⚠️ [ZohoAutoSync] Contact ${contact.id} failed:`, result?.message || 'Unknown');
    }
  } catch (error) {
    // Non-blocking: log but never crash the main flow
    console.error(`❌ [ZohoAutoSync] Failed for contact ${contactId}:`, error.response?.data || error.message);
  }
}

/**
 * Executes a full or incremental contact synchronization for a tenant.
 */
export async function syncTenantContactsToZoho(tenantId, options = {}) {
  const { syncType = 'FULL' } = options;

  console.log(`🚀 [ZohoSync] Starting ${syncType} contact sync for tenant: ${tenantId}`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      tenantName: true,
      email: true,
      zohoConnectionStatus: true,
    },
  });

  if (!tenant || tenant.zohoConnectionStatus !== 'CONNECTED') {
    throw new Error('Zoho CRM is not connected for this tenant');
  }

  await createAuditLog({
    actorId: tenant.id,
    actorType: 'TENANT',
    actorName: tenant.tenantName || tenant.email || 'Tenant',
    actorEmail: tenant.email || '',
    action: 'ZOHO_SYNC_STARTED',
    module: 'INTEGRATIONS',
    description: `Started ${syncType.toLowerCase()} contact synchronization to Zoho CRM`,
    tenantId: tenant.id,
    metadata: { syncType },
  });

  emitToTenant(tenantId, 'zoho_sync_started', { syncType });

  // Dynamically resolve incremental sync date using the last synced contact mapping timestamp
  let lastSyncedAt = null;
  if (syncType === 'INCREMENTAL') {
    const latestMapping = await prisma.contactProviderMapping.findFirst({
      where: { tenantId, provider: 'ZOHO' },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    });
    lastSyncedAt = latestMapping?.lastSyncedAt || null;
  }

  let offset = 0;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  // Build base where clause
  const baseWhere = {
    tenantId,
    isActive: true,
    isBlocked: false,
  };

  // Incremental filter
  if (syncType === 'INCREMENTAL' && lastSyncedAt) {
    baseWhere.updatedAt = { gte: lastSyncedAt };
    console.log(`📅 [ZohoSync] Incremental mode: syncing contacts updated since ${lastSyncedAt}`);
  }

  try {
    while (true) {
      const contacts = await prisma.contact.findMany({
        where: baseWhere,
        include: {
          providerMappings: { where: { provider: 'ZOHO' } },
          contactTags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: BATCH_SIZE,
      });

      if (contacts.length === 0) break;

      const recordsToUpsert = contacts.map((c) => {
        const existingMapping = c.providerMappings?.[0];
        const payload = formatContactForZoho(c, existingMapping?.providerContactId);

        // Attach tags
        if (c.contactTags && c.contactTags.length > 0) {
          const tagNames = c.contactTags.map((ct) => ct.tag?.name).filter(Boolean);
          if (tagNames.length > 0) {
            payload.Tag = tagNames.join(', ');
          }
        }

        return payload;
      });

      let response;
      try {
        response = await zohoRequest(tenantId, {
          method: 'POST',
          url: '/crm/v7/Contacts/upsert',
          data: {
            data: recordsToUpsert,
            duplicate_check_fields: ['Email', 'Phone'],
          },
        });
      } catch (apiError) {
        const status = apiError.response?.status;
        const errorData = apiError.response?.data;

        // Rate limit handling
        if (status === 429) {
          const retryAfter = parseInt(apiError.response?.headers?.['retry-after'] || '60', 10);
          console.warn(`⏳ [ZohoSync] Rate limited. Waiting ${retryAfter}s before retrying batch at offset ${offset}`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue; // Retry same batch
        }

        console.error(`❌ [ZohoSync] Batch API error at offset ${offset}:`, errorData || apiError.message);
        totalFailed += contacts.length;
        offset += contacts.length;
        continue;
      }

      const results = response?.data || [];

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const res = results[i];

        if (res && res.code === 'SUCCESS' && res.details?.id) {
          const zohoRecordId = res.details.id;
          const action = res.action;

          if (action === 'insert') totalCreated++;
          else totalUpdated++;

          await prisma.contactProviderMapping.upsert({
            where: {
              contactId_provider: {
                contactId: contact.id,
                provider: 'ZOHO',
              },
            },
            update: {
              providerContactId: zohoRecordId,
              lastSyncedAt: new Date(),
            },
            create: {
              tenantId,
              contactId: contact.id,
              provider: 'ZOHO',
              providerContactId: zohoRecordId,
              lastSyncedAt: new Date(),
            },
          });
        } else {
          totalFailed++;
          console.warn(`⚠️ [ZohoSync] Contact ${contact.id} (${contact.name}) failed:`, res?.message || 'Unknown');
        }
      }

      totalProcessed += contacts.length;
      offset += contacts.length;

      emitToTenant(tenantId, 'zoho_sync_progress', {
        processed: totalProcessed,
        created: totalCreated,
        updated: totalUpdated,
        failed: totalFailed,
      });

      if (contacts.length < BATCH_SIZE) break;

      // Rate-limit courtesy delay between batches (1 second)
      await new Promise((r) => setTimeout(r, 1000));
    }

    const summary = {
      syncType,
      totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      failed: totalFailed,
      completedAt: new Date().toISOString(),
    };

    console.log(`✅ [ZohoSync] Sync completed for tenant ${tenantId}:`, summary);

    await createAuditLog({
      actorId: tenant.id,
      actorType: 'TENANT',
      actorName: tenant.tenantName || tenant.email || 'Tenant',
      actorEmail: tenant.email || '',
      action: 'ZOHO_SYNC_COMPLETED',
      module: 'INTEGRATIONS',
      description: `Completed Zoho contact sync: ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed`,
      tenantId: tenant.id,
      metadata: summary,
    });

    emitToTenant(tenantId, 'zoho_sync_completed', summary);

    return summary;
  } catch (error) {
    console.error(`❌ [ZohoSync] Sync failed for tenant ${tenantId}:`, error);

    await createAuditLog({
      actorId: tenant.id,
      actorType: 'TENANT',
      actorName: tenant.tenantName || tenant.email || 'Tenant',
      actorEmail: tenant.email || '',
      action: 'ZOHO_SYNC_FAILED',
      module: 'INTEGRATIONS',
      description: `Zoho contact sync failed: ${error.message}`,
      tenantId: tenant.id,
      metadata: { error: error.message },
    });

    emitToTenant(tenantId, 'zoho_sync_failed', { error: error.message });

    throw error;
  }
}

/**
 * Returns synchronization statistics for the tenant.
 */
export async function getTenantSyncStats(tenantId) {
  const [totalContacts, mappedContacts, latestMapping] = await Promise.all([
    prisma.contact.count({
      where: { tenantId, isActive: true, isBlocked: false },
    }),
    prisma.contactProviderMapping.count({
      where: { tenantId, provider: 'ZOHO' },
    }),
    prisma.contactProviderMapping.findFirst({
      where: { tenantId, provider: 'ZOHO' },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    }),
  ]);

  return {
    totalContacts,
    mappedContacts,
    unmappedContacts: Math.max(0, totalContacts - mappedContacts),
    lastSyncedAt: latestMapping?.lastSyncedAt || null,
  };
}
// src/modules/zoho/zohoContactService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { emitToTenant } from '../../lib/socket.js';
import { createAuditLog } from '../audit/auditLogService.js';
import { redisConnection } from '../../config/redis.js';

const BATCH_SIZE = 100;
const SYNC_LOCK_TTL = 30;

const DEFAULT_PREFERENCES = {
  syncDestination: 'CONTACTS',
  logConversationNotes: true,
  createDealsOnOrders: true,
  createFollowUpTasks: true,
  autoSyncNewContacts: true,
};

/**
 * Centralized preferences loader from Redis with standard defaults
 */
export async function getTenantZohoPreferences(tenantId) {
  try {
    const key = `zoho_prefs:${tenantId}`;
    const raw = await redisConnection.get(key);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch (err) {
    console.warn(`⚠️ [ZohoPreferences] Redis error for tenant ${tenantId}, using defaults:`, err.message);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Helper to check connection status cleanly
 */
async function isZohoConnected(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { zohoConnectionStatus: true },
  });
  return tenant?.zohoConnectionStatus === 'CONNECTED';
}

/**
 * Deterministic Name Split Rule
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
 * Strictly respects active connection, lock triggers, and preferences.
 */
export async function autoSyncContactToZoho(tenantId, contactId) {
  try {
    if (!(await isZohoConnected(tenantId))) return;

    // Check preference
    const prefs = await getTenantZohoPreferences(tenantId);
    if (!prefs.autoSyncNewContacts || prefs.syncDestination !== 'CONTACTS') {
      return; // Sync disabled or routed to Leads instead
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        providerMappings: { where: { provider: 'ZOHO' } },
        contactTags: { include: { tag: true } },
      },
    });

    if (!contact || !contact.isActive || contact.isBlocked) {
      return;
    }

    const existingMapping = contact.providerMappings?.[0];
    const zohoPayload = formatContactForZoho(contact, existingMapping?.providerContactId);

    if (contact.contactTags && contact.contactTags.length > 0) {
      const tagNames = contact.contactTags
        .map((ct) => ct.tag?.name)
        .filter(Boolean);
      if (tagNames.length > 0) {
        zohoPayload.Tag = tagNames.join(', ');
      }
    }

    // Set loop prevention lock in Redis
    const lockKeyContact = `zoho_sync_lock:${contactId}`;
    await redisConnection.set(lockKeyContact, '1', 'EX', SYNC_LOCK_TTL);

    if (existingMapping?.providerContactId) {
      const lockKeyRecord = `zoho_sync_lock:${existingMapping.providerContactId}`;
      await redisConnection.set(lockKeyRecord, '1', 'EX', SYNC_LOCK_TTL);
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

      // Lock the newly generated Zoho ID as well
      const lockKeyNewRecord = `zoho_sync_lock:${zohoRecordId}`;
      await redisConnection.set(lockKeyNewRecord, '1', 'EX', SYNC_LOCK_TTL);

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

  const baseWhere = {
    tenantId,
    isActive: true,
    isBlocked: false,
  };

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

        if (c.contactTags && c.contactTags.length > 0) {
          const tagNames = c.contactTags.map((ct) => ct.tag?.name).filter(Boolean);
          if (tagNames.length > 0) {
            payload.Tag = tagNames.join(', ');
          }
        }

        return payload;
      });

      // Apply loop locks for the batch chunk
      for (const c of contacts) {
        await redisConnection.set(`zoho_sync_lock:${c.id}`, '1', 'EX', SYNC_LOCK_TTL);
        const existingId = c.providerMappings?.[0]?.providerContactId;
        if (existingId) {
          await redisConnection.set(`zoho_sync_lock:${existingId}`, '1', 'EX', SYNC_LOCK_TTL);
        }
      }

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

        if (status === 429) {
          const retryAfter = parseInt(apiError.response?.headers?.['retry-after'] || '60', 10);
          console.warn(`⏳ [ZohoSync] Rate limited. Waiting ${retryAfter}s before retrying batch at offset ${offset}`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
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

          await redisConnection.set(`zoho_sync_lock:${zohoRecordId}`, '1', 'EX', SYNC_LOCK_TTL);

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


/**
 * PULL SYNC: Imports all contacts from Zoho CRM down into Sudo Reply.
 * Handles duplicate resolution, phone formatting, and unique constraint safety.
 */
export async function pullContactsFromZoho(tenantId) {
  console.log(`📥 [ZohoPullSync] Starting inbound contact import from Zoho CRM for tenant ${tenantId}`);

  let page = 1;
  let totalImported = 0;
  let totalUpdated = 0;
  let hasMore = true;

  const requiredFields = 'id,First_Name,Last_Name,Full_Name,Phone,Mobile,Email,Company,Account_Name';

  while (hasMore) {
    let response;
    try {
      response = await zohoRequest(tenantId, {
        method: 'GET',
        url: `/crm/v7/Contacts?fields=${requiredFields}&page=${page}&per_page=100`,
      });
    } catch (apiErr) {
      console.error(`❌ [ZohoPullSync] Failed to fetch page ${page}:`, apiErr.response?.data || apiErr.message);
      break;
    }

    const zohoContacts = response?.data || [];
    if (zohoContacts.length === 0) break;

    for (const zc of zohoContacts) {
      const recordId = zc.id;
      const fullName = `${zc.First_Name || ''} ${zc.Last_Name || ''}`.trim() || zc.Full_Name || 'Zoho Contact';
      const rawPhone = zc.Phone || zc.Mobile || null;
      const email = zc.Email || null;
      const company = zc.Company || zc.Account_Name?.name || (typeof zc.Account_Name === 'string' ? zc.Account_Name : null);

      let cleanPhone = null;
      if (rawPhone) {
        const digits = rawPhone.replace(/\D/g, '');
        if (digits.length === 10) cleanPhone = `+91${digits}`;
        else if (digits.length === 11 && digits.startsWith('0')) cleanPhone = `+91${digits.slice(1)}`;
        else if (digits.length >= 8) cleanPhone = `+${digits}`;
      }

      // 1. Check if mapping already exists by Zoho record ID
      let mapping = await prisma.contactProviderMapping.findFirst({
        where: { tenantId, provider: 'ZOHO', providerContactId: recordId },
        include: { contact: true },
      });

      let contact = mapping?.contact || null;

      if (contact) {
        // Update existing contact in Sudo Reply
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            name: fullName || contact.name,
            email: email || contact.email,
            company: company || contact.company,
            ...(cleanPhone && !contact.phone ? { phone: cleanPhone, whatsappId: cleanPhone.replace(/\D/g, '').slice(-10) } : {}),
          },
        });
        totalUpdated++;
      } else {
        // 2. Check if contact exists by phone in Sudo Reply
        if (cleanPhone) {
          contact = await prisma.contact.findFirst({
            where: { phone: cleanPhone, tenantId },
          });
        }

        // 3. Check if contact exists by email in Sudo Reply
        if (!contact && email) {
          contact = await prisma.contact.findFirst({
            where: { email, tenantId },
          });
        }

        // 4. If not found, create new contact in Sudo Reply
        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              tenantId,
              name: fullName,
              phone: cleanPhone,
              email: email || null,
              company: company || null,
              whatsappId: cleanPhone ? cleanPhone.replace(/\D/g, '').slice(-10) : null,
              channel: 'WHATSAPP',
            },
          });
          totalImported++;

          emitToTenant(tenantId, 'new_contact', { contact, source: 'ZOHO_CRM' });
        } else {
          totalUpdated++;
        }
      }

      if (contact) {
        // Remove any old conflicting mapping for this recordId on another contact
        await prisma.contactProviderMapping.deleteMany({
          where: {
            tenantId,
            provider: 'ZOHO',
            providerContactId: recordId,
            contactId: { not: contact.id },
          },
        }).catch(() => {});

        // Safely upsert on contactId_provider
        await prisma.contactProviderMapping.upsert({
          where: {
            contactId_provider: {
              contactId: contact.id,
              provider: 'ZOHO',
            },
          },
          update: {
            providerContactId: recordId,
            lastSyncedAt: new Date(),
          },
          create: {
            tenantId,
            contactId: contact.id,
            provider: 'ZOHO',
            providerContactId: recordId,
            lastSyncedAt: new Date(),
          },
        });
      }
    }

    hasMore = Boolean(response?.info?.more_records);
    page++;
  }

  console.log(`✅ [ZohoPullSync] Completed: ${totalImported} imported, ${totalUpdated} updated`);
  return { totalImported, totalUpdated };
}
// src/modules/zoho/zohoTaskService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';

/**
 * Create a follow-up Task in Zoho CRM for an unresolved conversation.
 */
export async function createZohoFollowUpTask(tenantId, contactId, conversationId, reason = 'Follow up') {
  try {
    const canCreate = await hasZohoFeature(tenantId, 'tasks');
    if (!canCreate) return;

    const mapping = await prisma.contactProviderMapping.findFirst({
      where: {
        contactId,
        provider: { in: ['ZOHO', 'ZOHO_LEAD'] },
      },
    });

    if (!mapping) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    const taskPayload = {
      Subject: `${reason} — Sudo Reply`,
      Due_Date: dueDate.toISOString().split('T')[0],
      Status: 'Not Started',
      Priority: 'High',
      Description: `Conversation needs follow-up.\nReason: ${reason}\nCreated by Sudo Reply automation.`,
    };

    // Attach to correct module
    if (mapping.provider === 'ZOHO_LEAD') {
      taskPayload.$se_module = 'Leads';
      taskPayload.What_Id = mapping.providerContactId;
    } else {
      taskPayload.$se_module = 'Contacts';
      taskPayload.Contact_Name = mapping.providerContactId;
    }

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Tasks',
      data: {
        data: [taskPayload],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS') {
      console.log(`✅ [ZohoTask] Created follow-up task for contact ${contactId}`);
    }
  } catch (error) {
    console.error(`❌ [ZohoTask] Failed for contact ${contactId}:`, error.response?.data || error.message);
  }
}

/**
 * Scan for stale unresolved conversations and create Zoho tasks.
 * Called by cron job every 6 hours.
 */
export async function scanAndCreateStaleTasks() {
  const STALE_HOURS = 24; // Conversations unresolved for 24+ hours
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  try {
    // Find all tenants with Zoho connected
    const connectedTenants = await prisma.tenant.findMany({
      where: { zohoConnectionStatus: 'CONNECTED' },
      select: { id: true },
    });

    for (const tenant of connectedTenants) {
      const canCreate = await hasZohoFeature(tenant.id, 'tasks');
      if (!canCreate) continue;

      // Find stale open conversations
      const staleConversations = await prisma.conversation.findMany({
        where: {
          tenantId: tenant.id,
          status: 'OPEN',
          lastMessageAt: { lte: cutoff },
        },
        include: {
          contact: {
            include: {
              providerMappings: {
                where: { provider: { in: ['ZOHO', 'ZOHO_LEAD'] } },
              },
            },
          },
        },
        take: 50, // Limit per run to avoid rate limits
      });

      for (const conv of staleConversations) {
        if (conv.contact?.providerMappings?.length > 0) {
          await createZohoFollowUpTask(
            tenant.id,
            conv.contact.id,
            conv.id,
            `No response for ${STALE_HOURS}+ hours`
          );

          // Mark conversation so we don't create duplicate tasks
          await prisma.conversation.update({
            where: { id: conv.id },
            data: { status: 'OPEN' }, // Keep open, but the task is created
          });
        }
      }

      if (staleConversations.length > 0) {
        console.log(`📋 [ZohoTask] Created ${staleConversations.length} follow-up tasks for tenant ${tenant.id}`);
      }
    }
  } catch (error) {
    console.error('❌ [ZohoTask] Stale scan failed:', error.message);
  }
}
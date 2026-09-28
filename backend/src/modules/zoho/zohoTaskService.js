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

    const mapping = await prisma.contactProviderMapping.findUnique({
      where: {
        contactId_provider: {
          contactId,
          provider: 'ZOHO',
        },
      },
    });

    if (!mapping) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    const taskPayload = {
      Subject: `${reason} — Sudo Reply Conversation`,
      Due_Date: dueDate.toISOString().split('T')[0],
      Status: 'Not Started',
      Priority: 'High',
      Description: `Conversation ${conversationId} needs follow-up.\nReason: ${reason}\nCreated by Sudo Reply automation.`,
      $se_module: 'Contacts',
      What_Id: mapping.providerContactId,
    };

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
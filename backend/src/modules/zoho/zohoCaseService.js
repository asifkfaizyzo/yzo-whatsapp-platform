// src/modules/zoho/zohoCaseService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';

/**
 * Push a Sudo Reply Ticket to Zoho CRM as a Case.
 * 
 * @param {string} tenantId - Sudo Reply Tenant ID
 * @param {string} ticketId - Sudo Reply Ticket ID
 */
export async function syncTicketToZohoCase(tenantId, ticketId) {
  try {
    const canSync = await hasZohoFeature(tenantId, 'tasks'); // Available on Standard+
    if (!canSync) return null;

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!ticket) return null;

    const priorityMap = {
      LOW: 'Low',
      MEDIUM: 'Medium',
      HIGH: 'High',
      URGENT: 'Critical',
    };

    const statusMap = {
      OPEN: 'New',
      IN_PROGRESS: 'In Progress',
      RESOLVED: 'Closed',
      CLOSED: 'Closed',
    };

    const casePayload = {
      Subject: `[Ticket #${ticket.ticketNumber}] ${ticket.title}`,
      Description: ticket.description || 'Created via Sudo Reply Ticket system.',
      Status: statusMap[ticket.status] || 'New',
      Priority: priorityMap[ticket.priority] || 'Medium',
      Case_Origin: 'WhatsApp',
      Type: ticket.category || 'General',
    };

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Cases',
      data: {
        data: [casePayload],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS' && result.details?.id) {
      console.log(`🎫 [ZohoCase] Created Zoho Case ${result.details.id} for Ticket #${ticket.ticketNumber}`);
      return result.details.id;
    }

    return null;
  } catch (error) {
    console.error(`❌ [ZohoCase] Failed to sync ticket ${ticketId}:`, error.response?.data || error.message);
    return null;
  }
}
// src/modules/zoho/zohoNoteService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';

/**
 * Log a WhatsApp message as a Note in the Zoho Contact record.
 * Called from webhook worker for every inbound/outbound message.
 * Non-blocking — failures are silently logged.
 */
export async function logMessageAsZohoNote(tenantId, contactId, message) {
  try {
    const canLog = await hasZohoFeature(tenantId, 'notes');
    if (!canLog) return;

    // Find Zoho contact mapping (check both ZOHO and ZOHO_LEAD providers)
    const mapping = await prisma.contactProviderMapping.findFirst({
      where: {
        contactId,
        provider: { in: ['ZOHO', 'ZOHO_LEAD'] },
      },
    });

    if (!mapping) return; // Contact not synced to Zoho yet

    const direction = message.direction === 'INBOUND' ? '📥 From Customer' : '📤 From Agent';
    const senderLabel = message.senderType === 'CONTACT'
      ? 'Customer'
      : message.senderType === 'TENANT'
        ? 'Tenant Admin'
        : message.senderType === 'USER'
          ? 'Agent'
          : 'System';

    let noteContent = `${direction}\n`;
    noteContent += `Sender: ${senderLabel}\n`;
    noteContent += `Time: ${new Date(message.createdAt || Date.now()).toLocaleString('en-IN')}\n`;
    noteContent += `Channel: ${message.channel || 'WhatsApp'}\n\n`;

    if (message.type === 'TEXT' && message.text) {
      noteContent += message.text;
    } else if (message.type === 'IMAGE') {
      noteContent += `[Image: ${message.mediaName || 'photo'}]${message.caption ? `\nCaption: ${message.caption}` : ''}`;
    } else if (message.type === 'VIDEO') {
      noteContent += `[Video: ${message.mediaName || 'video'}]`;
    } else if (message.type === 'AUDIO') {
      noteContent += `[Audio: ${message.mediaName || 'voice message'}]`;
    } else if (message.type === 'FILE') {
      noteContent += `[Document: ${message.mediaName || 'file'}]`;
    } else if (message.type === 'LOCATION') {
      noteContent += `[Location: ${message.locName || ''} ${message.locAddress || ''} (${message.locLatitude}, ${message.locLongitude})]`;
    } else if (message.type === 'ORDER') {
      noteContent += message.text || '[Order placed]';
    } else {
      noteContent += message.text || `[${message.type}]`;
    }

    // Determine the Zoho module based on provider type
    const zohoModule = mapping.provider === 'ZOHO_LEAD' ? 'Leads' : 'Contacts';

    await zohoRequest(tenantId, {
      method: 'POST',
      url: `/crm/v7/${zohoModule}/${mapping.providerContactId}/Notes`,
      data: {
        data: [
          {
            Note_Title: `${direction} — ${new Date().toLocaleDateString('en-IN')}`,
            Note_Content: noteContent.substring(0, 5000), // Zoho limit
          },
        ],
      },
    });

    console.log(`📝 [ZohoNote] Logged ${message.direction} message for contact ${contactId} → Zoho ${zohoModule}`);
  } catch (error) {
    // Non-blocking
    console.error(`❌ [ZohoNote] Failed for contact ${contactId}:`, error.response?.data || error.message);
  }
}
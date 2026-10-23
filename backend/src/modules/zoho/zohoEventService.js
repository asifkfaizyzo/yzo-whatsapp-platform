// src/modules/zoho/zohoEventService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';
import { sendMessageService } from '../messages/messageService.js';

/**
 * Book an Event / Appointment in Zoho CRM and send WhatsApp confirmation.
 */
export async function createZohoCalendarEvent(tenantId, contactId, eventDetails) {
  try {
    const canSchedule = await hasZohoFeature(tenantId, 'tasks');
    if (!canSchedule) return { success: false, message: 'Events not available on current plan' };

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        providerMappings: { where: { provider: 'ZOHO' } },
      },
    });

    if (!contact) throw new Error('Contact not found');

    const mapping = contact.providerMappings?.[0];
    const { title, startTime, endTime, venue } = eventDetails;

    const startISO = new Date(startTime).toISOString();
    const endISO = new Date(endTime || new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();

    const eventPayload = {
      Event_Title: title || 'WhatsApp Consultation Meeting',
      Start_DateTime: startISO,
      End_DateTime: endISO,
      Venue: venue || 'WhatsApp / Video Call',
      Description: `Booked via Sudo Reply WhatsApp on ${new Date().toLocaleDateString('en-IN')}`,
    };

    if (mapping?.providerContactId) {
      eventPayload.$se_module = 'Contacts';
      eventPayload.What_Id = mapping.providerContactId;
    }

    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/Events',
      data: {
        data: [eventPayload],
      },
    });

    const result = response?.data?.[0];

    if (result && result.code === 'SUCCESS' && result.details?.id) {
      console.log(`📅 [ZohoEvent] Booked Event "${title}" (${result.details.id}) for contact ${contactId}`);

      // Auto-send WhatsApp Confirmation Message
      const readableDate = new Date(startTime).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const confirmMsg = `🗓️ *Meeting Confirmed!*\n\n• *Topic:* ${title || 'Consultation'}\n• *Time:* ${readableDate}\n• *Venue:* ${venue || 'Online'}\n\nWe look forward to speaking with you!`;

      await sendMessageService({
        contactId,
        tenantId,
        senderId: tenantId,
        senderType: 'SYSTEM',
        text: confirmMsg,
      }).catch(() => {});

      return {
        success: true,
        eventId: result.details.id,
        scheduledAt: readableDate,
      };
    }

    return { success: false, message: result?.message || 'Event creation failed' };
  } catch (error) {
    console.error(`❌ [ZohoEvent] Scheduling failed:`, error.response?.data || error.message);
    return { success: false, message: error.message };
  }
}
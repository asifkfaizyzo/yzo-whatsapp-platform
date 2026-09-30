// src/modules/zoho/zohoInvoiceService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';
import { sendMessageService } from '../messages/messageService.js';

/**
 * Dispatch an interactive WhatsApp payment message for a Zoho Invoice.
 */
export async function sendZohoInvoiceToWhatsApp(tenantId, contactId, invoiceId) {
  try {
    const canInvoice = await hasZohoFeature(tenantId, 'deals');
    if (!canInvoice) return { success: false, message: 'Invoices not supported on plan' };

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact || !contact.phone) {
      throw new Error('Contact phone not found');
    }

    // Fetch Invoice from Zoho CRM
    const response = await zohoRequest(tenantId, {
      method: 'GET',
      url: `/crm/v7/Invoices/${invoiceId}`,
    });

    const invoice = response?.data?.[0];
    if (!invoice) throw new Error('Invoice not found in Zoho CRM');

    const subject = invoice.Subject || `INV-${invoiceId.slice(-6)}`;
    const grandTotal = Number(invoice.Grand_Total) || 0;
    const status = invoice.Status || 'Draft';
    const dueDate = invoice.Due_Date || 'Due on receipt';

    const invoiceMsg =
      `📄 *Invoice Received: ${subject}*\n\n` +
      `💰 *Amount Due:* ₹${grandTotal.toFixed(2)}\n` +
      `📅 *Due Date:* ${dueDate}\n` +
      `📌 *Status:* ${status}\n\n` +
      `Please reply to this chat if you have any questions or need payment assistance.`;

    await sendMessageService({
      contactId,
      tenantId,
      senderId: tenantId,
      senderType: 'SYSTEM',
      text: invoiceMsg,
    });

    console.log(`📤 [ZohoInvoice] Sent Invoice ${invoiceId} (₹${grandTotal}) to WhatsApp contact ${contactId}`);
    return { success: true, grandTotal, subject };
  } catch (error) {
    console.error(`❌ [ZohoInvoice] Failed to dispatch invoice:`, error.response?.data || error.message);
    return { success: false, message: error.message };
  }
}
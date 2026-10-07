// import crypto from 'crypto';
// import axios from 'axios';
// import prisma from '../../config/prisma.js';

// // Safe dynamic lookup for logLeadStatusToSheet to prevent ERR_MODULE_NOT_FOUND crashes
// let logLeadStatusToSheet = null;

// try {
//   // Attempt primary import path
//   const sheetModule = await import('./googleSheetController.js').catch(() => null) 
//     || await import('../google-sheets/googleSheetsService.js').catch(() => null)
//     || await import('../googlesheet/googleSheetController.js').catch(() => null);
  
//   if (sheetModule && sheetModule.logLeadStatusToSheet) {
//     logLeadStatusToSheet = sheetModule.logLeadStatusToSheet;
//   }
// } catch (importErr) {
//   console.warn('⚠️ [WooCommerceWebhook] Google Sheets module dynamic import warning:', importErr.message);
// }

// export const handleWooCommerceWebhook = async (req, res) => {
//   const topic = req.headers['x-wc-webhook-topic'] || 'order.created';
//   const source = req.headers['x-wc-webhook-source'] || '';
  
//   console.log(`🔔 [WooCommerceWebhook] Received event "${topic}" from source: ${source}`);

//   try {
//     // 1. Ping test event verification from WooCommerce
//     if (topic === 'action.woocommerce_webhook_topic' || req.body?.webhook_id) {
//       console.log('✅ [WooCommerceWebhook] Ping test event verified.');
//       return res.status(200).json({ success: true, message: 'Webhook ping verified' });
//     }

//     // 2. Resolve Tenant ID
//     let tenantId = req.query.tenantId;

//     if (!tenantId && source) {
//       const cleanDomain = source.replace(/https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
//       const connection = await prisma.wooCommerceConnection.findFirst({
//         where: {
//           storeUrl: { contains: cleanDomain }
//         }
//       });
//       if (connection) {
//         tenantId = connection.tenantId;
//       }
//     }

//     // Fallback: Bind to single active connection in dev environment
//     if (!tenantId) {
//       const allConnections = await prisma.wooCommerceConnection.findMany({ take: 2 });
//       if (allConnections.length === 1) {
//         tenantId = allConnections[0].tenantId;
//         console.log(`ℹ️ [WooCommerceWebhook] Auto-assigned single tenant: ${tenantId}`);
//       }
//     }

//     if (!tenantId) {
//       console.warn('⚠️ [WooCommerceWebhook] Tenant ID could not be resolved.');
//       return res.status(200).json({ success: true, message: 'Webhook received but tenant unresolved' });
//     }

//     const payload = req.body;
//     if (!payload || !payload.id) {
//       return res.status(200).json({ success: true, message: 'Empty payload' });
//     }

//     // 3. Process Order Events
//     if (topic.includes('order')) {
//       const externalOrderId = String(payload.id);
//       const orderNumber = String(payload.number || payload.id);
//       const status = payload.status || 'pending';
//       const paymentMethod = payload.payment_method_title || payload.payment_method || 'COD';
//       const total = parseFloat(payload.total || '0.0');
//       const currency = payload.currency || 'INR';

//       const billing = payload.billing || {};
//       const shipping = payload.shipping || {};

//       const customerName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Customer';
//       let rawPhone = billing.phone || shipping.phone || '';
//       const customerEmail = billing.email || '';

//       // Format Phone Number to E.164 (+91...)
//       let cleanDigits = rawPhone.replace(/\D/g, '');
//       if (cleanDigits.length === 10) {
//         cleanDigits = `91${cleanDigits}`;
//       }
//       let customerPhone = cleanDigits ? `+${cleanDigits}` : '';

//       const lineItems = (payload.line_items || []).map(item => ({
//         id: item.id,
//         name: item.name,
//         quantity: item.quantity,
//         price: item.price,
//         total: item.total
//       }));

//       // A. Upsert Order in PostgreSQL
//       const order = await prisma.ecommerceOrder.upsert({
//         where: {
//           tenantId_source_externalOrderId: {
//             tenantId,
//             source: 'WOOCOMMERCE',
//             externalOrderId
//           }
//         },
//         update: {
//           status,
//           paymentMethod,
//           total,
//           customerName,
//           customerPhone,
//           customerEmail,
//           shippingAddress: shipping,
//           lineItems
//         },
//         create: {
//           tenantId,
//           source: 'WOOCOMMERCE',
//           externalOrderId,
//           orderNumber,
//           status,
//           paymentMethod,
//           total,
//           currency,
//           customerName,
//           customerPhone,
//           customerEmail,
//           shippingAddress: shipping,
//           lineItems
//         }
//       });

//       console.log(`📦 [WooCommerceWebhook] Order #${orderNumber} saved to DB for tenant: ${tenantId}`);

//       // B. Sync Contact, Conversation, and Message
//       if (customerPhone) {
//         let contact = await prisma.contact.findFirst({
//           where: { tenantId, phone: customerPhone }
//         });

//         if (!contact) {
//           contact = await prisma.contact.create({
//             data: {
//               tenantId,
//               phone: customerPhone,
//               name: customerName,
//               email: customerEmail
//             }
//           });
//         } else if (!contact.name || contact.name === 'Customer') {
//           await prisma.contact.update({
//             where: { id: contact.id },
//             data: { name: customerName, email: customerEmail }
//           });
//         }

//         let conversation = await prisma.conversation.findFirst({
//           where: { tenantId, contactId: contact.id }
//         });

//         if (!conversation) {
//           conversation = await prisma.conversation.create({
//             data: {
//               tenantId,
//               contactId: contact.id,
//               status: 'OPEN'
//             }
//           });
//         }

//         const itemsList = lineItems.map(i => `${i.name} (x${i.quantity})`).join(', ');
//         const messageText = `🎉 *Order Confirmation!*\n\nHi *${customerName}*,\nYour order *#${orderNumber}* has been received successfully!\n\n📦 *Items:* ${itemsList || 'WooCommerce Items'}\n💰 *Total:* ${currency} ${total}\n💳 *Payment Method:* ${paymentMethod}\n\nThank you for shopping with us!`;

//         const messageRecord = await prisma.message.create({
//           data: {
//             conversationId: conversation.id,
//             senderId: 'SYSTEM',
//             senderType: 'SYSTEM',
//             direction: 'OUTBOUND',
//             text: messageText,
//             type: 'TEXT',
//             status: 'sent'
//           }
//         });

//         await prisma.conversation.update({
//           where: { id: conversation.id },
//           data: {
//             lastMessageAt: new Date(),
//             updatedAt: new Date()
//           }
//         });

//         console.log(`💬 [WooCommerceWebhook] Message saved to Chat UI for ${customerName} (${customerPhone})`);

//         // Emit Socket.io Realtime Events
//         // if (global.io) {
//         //   try {
//         //     global.io.to(`tenant:${tenantId}`).emit('new_message', {
//         //       message: messageRecord,
//         //       conversationId: conversation.id
//         //     });
//         //     global.io.to(`tenant:${tenantId}`).emit('woocommerce_order_received', {
//         //       order,
//         //       contact
//         //     });
//         //   } catch (e) {
//         //     // Silent catch for socket errors
//         //   }
//         // }


//                 // Emit Socket.io Realtime Events (Dual Room Broadcast)
//         if (global.io) {
//           try {
//             const msgPayload = { message: messageRecord, conversationId: conversation.id };
//             const orderPayload = { order, contact };

//             // Emit to both room patterns so UI updates instantly
//             global.io.to(`tenant:${tenantId}`).emit('new_message', msgPayload);
//             global.io.to(tenantId).emit('new_message', msgPayload);

//             global.io.to(`tenant:${tenantId}`).emit('woocommerce_order_received', orderPayload);
//             global.io.to(tenantId).emit('woocommerce_order_received', orderPayload);
//           } catch (e) {
//             // Silent catch for socket errors
//           }
//         }

//         // Emit Socket.io Realtime Events (Dual Room Broadcast + Conversation Update)
//         // if (global.io) {
//         //   try {
//         //     const msgPayload = { 
//         //       message: messageRecord, 
//         //       conversationId: conversation.id,
//         //       contact
//         //     };
//         //     const orderPayload = { order, contact };

//         //     // 1. Broadcast to both room formats so open Inbox updates instantly
//         //     const rooms = [`tenant:${tenantId}`, tenantId];

//         //     rooms.forEach(room => {
//         //       global.io.to(room).emit('new_message', msgPayload);
//         //       global.io.to(room).emit('conversation_updated', {
//         //         conversationId: conversation.id,
//         //         lastMessage: messageRecord,
//         //         updatedAt: new Date()
//         //       });
//         //       global.io.to(room).emit('woocommerce_order_received', orderPayload);
//         //     });

//         //     console.log(`⚡ [Socket.io] Emitted real-time events to tenant rooms for ${customerName}`);
//         //   } catch (e) {
//         //     console.error('⚠️ [Socket.io] Broadcast error:', e.message);
//         //   }
//         // }


//         // C. Auto-sync ALL Fields to Google Sheets (Safe Payload References)
//         if (typeof logLeadStatusToSheet === 'function') {
//           try {
//             const formattedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Processing';
//             const isPaid = status.toUpperCase() === 'COMPLETED' || status.toUpperCase() === 'PROCESSING';

//             const deliveryLocation = [
//               shipping.address_1 || billing.address_1 || '',
//               shipping.city || billing.city || '',
//               shipping.state || billing.state || '',
//               shipping.postcode || billing.postcode || ''
//             ].filter(Boolean).join(', ') || 'N/A';

//             const rawNote = payload.customer_note || payload.customer_notes || payload.note || '';
//             const cleanedNotes = rawNote.trim().length > 0 ? rawNote.trim() : `WooCommerce Order #${orderNumber}`;

//             await logLeadStatusToSheet(tenantId, {
//               "Contact Name": customerName,
//               "Phone Number": customerPhone,
//               "Order Status": formattedStatus,
//               "Lead Status": formattedStatus,
//               "Order ID": `#${orderNumber}`,
//               "Total Amount": `${currency} ${total}`,
//               "Payment Status": isPaid ? 'Paid' : 'Pending',
//               "Payment Method": paymentMethod,
//               "Products": itemsList || '1 Item',
//               "Delivery Location": deliveryLocation,
//               "Notes": cleanedNotes,
//               "Timestamp": new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),

//               // Fallback camelCase properties
//               contactName: customerName,
//               phone: customerPhone,
//               orderStatus: formattedStatus,
//               orderId: `#${orderNumber}`,
//               totalAmount: `${currency} ${total}`,
//               paymentStatus: isPaid ? 'Paid' : 'Pending',
//               paymentMethod: paymentMethod,
//               products: itemsList || '1 Item',
//               deliveryLocation: deliveryLocation,
//               notes: cleanedNotes
//             });
//             console.log(`📊 [WooCommerceWebhook] Order #${orderNumber} fully synced to Google Sheets!`);
//           } catch (sheetErr) {
//             console.error('⚠️ [WooCommerceWebhook] Google Sheets sync error:', sheetErr.message);
//           }
//         }

//         // D. WhatsApp Meta Template Notification
//         const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
//         const whatsappToken = process.env.WHATSAPP_TOKEN;

//         if (phoneNumberId && whatsappToken) {
//           try {
//             const cleanRecipientPhone = customerPhone.replace(/\+/g, '');

//             const tenantTemplate = await prisma.template?.findFirst({
//               where: {
//                 tenantId,
//                 status: 'APPROVED',
//                 OR: [
//                   { category: 'UTILITY' },
//                   { name: { contains: 'order' } }
//                 ]
//               }
//             }).catch(() => null);

//             let templatePayload;

//             if (tenantTemplate) {
//               console.log(`📋 [WooCommerceWebhook] Using tenant approved template: "${tenantTemplate.name}"`);
//               templatePayload = {
//                 messaging_product: 'whatsapp',
//                 recipient_type: 'individual',
//                 to: cleanRecipientPhone,
//                 type: 'template',
//                 template: {
//                   name: tenantTemplate.name,
//                   language: { code: tenantTemplate.language || 'en_US' },
//                   components: [
//                     {
//                       type: 'body',
//                       parameters: [
//                         { type: 'text', text: customerName },
//                         { type: 'text', text: orderNumber },
//                         { type: 'text', text: currency },
//                         { type: 'text', text: String(total) },
//                         { type: 'text', text: paymentMethod }
//                       ]
//                     }
//                   ]
//                 }
//               };
//             } else {
//               console.log(`📋 [WooCommerceWebhook] Defaulting to Meta sample template: "hello_world"`);
//               templatePayload = {
//                 messaging_product: 'whatsapp',
//                 recipient_type: 'individual',
//                 to: cleanRecipientPhone,
//                 type: 'template',
//                 template: {
//                   name: 'hello_world',
//                   language: { code: 'en_US' }
//                 }
//               };
//             }

//             const waResponse = await axios.post(
//               `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
//               templatePayload,
//               { headers: { 'Authorization': `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' } }
//             );

//             const wamid = waResponse?.data?.messages?.[0]?.id;
//             if (wamid) {
//               await prisma.message.update({
//                 where: { id: messageRecord.id },
//                 data: { wamid }
//               }).catch(() => null);
//             }

//             console.log(`📱 [WooCommerceWebhook] WhatsApp template delivered to ${cleanRecipientPhone}`);
//           } catch (waErr) {
//             console.error('⚠️ [WooCommerceWebhook] WhatsApp API sending error:', waErr.response?.data || waErr.message);
//           }
//         }
//       }
//     }

//     return res.status(200).json({ success: true, message: 'Webhook processed successfully' });

//   } catch (error) {
//     console.error('💥 [WooCommerceWebhook] Internal Error:', error);
//     return res.status(200).json({ success: true, message: 'Error handled gracefully' });
//   }
// };





import { createHash } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { orderWebhookQueue, QUEUE_NAME_ORDER_WEBHOOK } from '../../queues/orderWebhookQueue.js';

/**
 * Handle incoming WooCommerce Webhook events
 * Parses & validates payloads and hands off heavy tasks to BullMQ
 */
export const handleWooCommerceWebhook = async (req, res) => {
  const topic = req.headers['x-wc-webhook-topic'] || 'order.created';
  const source = req.headers['x-wc-webhook-source'] || '';
  const payload = req.body;

  console.log(`🔔 [WooCommerceWebhook] Received event "${topic}" from source: ${source}`);
  if (['customer.created', 'customer.login', 'customer.logout'].includes(topic)) {
    console.log(
      `[WooCommerce Account Event] Received "${topic}" for customer ${payload?.id || 'unknown'}`
    );
  }

  try {
    // 1. Handshake verification ping from WooCommerce
    if (topic === 'action.woocommerce_webhook_topic' || payload?.webhook_id) {
      console.log('✅ [WooCommerceWebhook] Handshake ping verified.');
      return res.status(200).json({ success: true, message: 'Webhook ping verified' });
    }

    if (!payload || !payload.id) {
      return res.status(200).json({ success: true, message: 'Empty payload ignored' });
    }

    // 2. Resolve Tenant ID
    // Priority A: Explicit URL query param (Crucial for TasteWP and local ngrok tunnels)
    let tenantId = req.query.tenantId;

    // Priority B: Domain lookup matching against storeUrl
    if (!tenantId && source) {
      const cleanDomain = source
        .replace(/https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^www\./, '')
        .trim()
        .toLowerCase();

      const connection = await prisma.wooCommerceConnection.findFirst({
        where: {
          storeUrl: { contains: cleanDomain }
        }
      });
      if (connection) {
        tenantId = connection.tenantId;
        console.log(`🔗 [WooCommerceWebhook] Resolved tenant: ${tenantId} via domain: "${cleanDomain}"`);
      }
    }

    // Priority C: Auto-bind to single tenant connection in dev environment
    if (!tenantId) {
      const allConnections = await prisma.wooCommerceConnection.findMany({ take: 2 });
      if (allConnections.length === 1) {
        tenantId = allConnections[0].tenantId;
        console.log(`ℹ️ [WooCommerceWebhook] Auto-assigned sole tenant: ${tenantId}`);
      }
    }

     console.log('1️⃣ Webhook hit! Resolved tenantId:', tenantId);

    if (!tenantId) {
      console.warn('⚠️ [WooCommerceWebhook] Unresolvable Tenant ID. Drop execution.');
      return res.status(200).json({ success: true, message: 'Webhook accepted but ignored: Unresolved Tenant' });
    }

    // 3. Queue the event inside BullMQ (Instant Hand-off)
    const deliveryId = req.headers['x-wc-webhook-delivery-id'];
    const eventVersion = deliveryId || payload.date_modified_gmt || payload.date_modified ||
      createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const safeEventVersion = String(eventVersion).replace(/[^a-zA-Z0-9_-]/g, '');
    const jobId = `wc_${tenantId}_${payload.id}_${topic}_${safeEventVersion}`;
    await orderWebhookQueue.add(
      'woocommerce-order',
      {
        type: 'WOOCOMMERCE',
        tenantId,
        topic,
        source,
        payload
      },
      {
        jobId,
        // Prevent infinite retries of structural data issues
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000 // 10 seconds incremental scale
        }
      }
    );

    console.log(
      `⚡ [WooCommerceWebhook] Queued ${topic} job for customer/order #${payload.id} in BullMQ`
    );
    return res.status(200).json({ success: true, message: 'Event accepted and queued' });

  } catch (error) {
    console.error('💥 [WooCommerceWebhook] Controller Fatal Error:', error);
    // Returning 500 forces WooCommerce to attempt retry deliveries on failures
    return res.status(500).json({ success: false, error: 'Database/Queue Dispatch Failure' });
  }
};
// backend/src/modules/shopify/shopifyOrderLifecycle.js
import axios from 'axios';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { emitToTenant } from '../../lib/socket.js';
import { logLeadStatusToSheet } from '../google-sheets/googleSheetsService.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import {
  handleCheckoutUpdate,
  cancelCartReminders,
} from './shopifyCartRecoveryService.js';

// ─────────────────────────────────────────────────────────────
// Environment Auto-Detection (Dev vs Production Meta WA)
// ─────────────────────────────────────────────────────────────
export const isProductionEnvironment = () => {
  const url = (process.env.BACKEND_URL || '').toLowerCase();
  if (!url) return false;
  const devPatterns = ['localhost', '127.0.0.1', 'trycloudflare.com', 'ngrok', 'localtunnel', 'serveo.net'];
  return !devPatterns.some(pattern => url.includes(pattern));
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY: Helper to find or create Contact + Conversation
// ─────────────────────────────────────────────────────────────
export const getOrCreateShopifyContact = async ({ tenantId, customerPhone, customerName, customerEmail }) => {
  if (!customerPhone) return { contact: null, conversation: null };

  let contact = await prisma.contact.findFirst({
    where: { tenantId, phone: customerPhone }
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: { tenantId, phone: customerPhone, name: customerName, email: customerEmail }
    });
  } else if (!contact.name || contact.name === 'Customer') {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name: customerName, email: customerEmail }
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { tenantId, contactId: contact.id }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { tenantId, contactId: contact.id, status: 'OPEN' }
    });
  }

  return { contact, conversation };
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY: Save message to inbox + emit socket events
// ─────────────────────────────────────────────────────────────
export const saveShopifyInboxMessage = async ({ tenantId, conversation, contact, messageText, orderRecord }) => {
  const messageRecord = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: 'SYSTEM',
      senderType: 'SYSTEM',
      direction: 'OUTBOUND',
      text: messageText,
      type: 'TEXT',
      status: 'sent'
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), updatedAt: new Date() }
  });

  try {
    emitToTenant(tenantId, 'new_message', { message: messageRecord, conversationId: conversation.id, contact });
    emitToTenant(tenantId, 'unread_count_update', { tenantId });
    if (orderRecord) {
      emitToTenant(tenantId, 'shopify_order_received', { order: orderRecord, contact });
    }
  } catch (sockErr) {
    console.error('⚠️ Socket emit error:', sockErr.message);
  }

  return messageRecord;
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY: Send WhatsApp Template (Production Only)
// ─────────────────────────────────────────────────────────────
export const sendShopifyWhatsAppTemplate = async ({ tenantId, customerPhone, templateNamePatterns, templateParams }) => {
  if (!isProductionEnvironment()) {
    console.log(`🧪 [Shopify Dev] WhatsApp template skipped (dev mode). Would send to ${customerPhone}`);
    return null;
  }

  try {
    const tenantConfig = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappPhoneId: true, whatsappAccessToken: true }
    });

    const phoneNumberId = tenantConfig?.whatsappPhoneId;
    const whatsappToken = tenantConfig?.whatsappAccessToken ? decrypt(tenantConfig.whatsappAccessToken) : null;

    if (!phoneNumberId || !whatsappToken) {
      console.warn(`⚠️ [Shopify WA] Skipped for tenant ${tenantId}: WhatsApp not connected.`);
      return null;
    }

    const orConditions = templateNamePatterns.map(pattern => ({ name: { contains: pattern } }));

    const approvedTemplate = await prisma.template.findFirst({
      where: {
        tenantId,
        status: 'APPROVED',
        OR: orConditions
      }
    }).catch(() => null);

    if (!approvedTemplate) {
      console.warn(`⚠️ [Shopify WA] No APPROVED template matching [${templateNamePatterns.join(', ')}] for tenant ${tenantId}`);
      return null;
    }

    const cleanRecipientPhone = customerPhone.replace(/\+/g, '');

    const templatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipientPhone,
      type: 'template',
      template: {
        name: approvedTemplate.name,
        language: { code: approvedTemplate.language || 'en_US' },
        components: templateParams.length
          ? [{
              type: 'body',
              parameters: templateParams.map(text => ({ type: 'text', text: String(text) }))
            }]
          : []
      }
    };

    const waResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      templatePayload,
      { headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' } }
    );

    console.log(`✅ [Shopify WA] Template "${approvedTemplate.name}" sent to ${cleanRecipientPhone} (WAMID: ${waResponse.data?.messages?.[0]?.id || 'ok'})`);
    return waResponse.data;
  } catch (waErr) {
    console.error(`❌ [Shopify WA Error]:`, waErr.response?.data || waErr.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY: Deduplication Check
// ─────────────────────────────────────────────────────────────
export const isShopifyEventDuplicate = async (tenantId, orderId, eventType) => {
  try {
    const existing = await prisma.webhookEvent.findFirst({
      where: {
        tenantId,
        provider: 'SHOPIFY',
        eventId: `${orderId}_${eventType}`
      }
    });
    return !!existing;
  } catch {
    return false;
  }
};

export const recordShopifyEvent = async (tenantId, orderId, eventType) => {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'SHOPIFY',
        eventId: `${orderId}_${eventType}`,
        tenantId,
        eventType
      }
    });
  } catch (err) {
    if (err.code !== 'P2002') {
      console.warn(`⚠️ [Shopify Dedup] Failed to record event: ${err.message}`);
    }
  }
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY → Google Sheets Sync
// ─────────────────────────────────────────────────────────────
export const logShopifyOrderToSheet = async ({
  tenantId,
  customerName,
  customerPhone,
  orderNumber,
  orderStatus,
  paymentStatus,
  paymentMethod,
  currency,
  total,
  itemsList,
  shipping = {},
  billing = {},
  trackingProvider = '',
  trackingNumber = '',
  trackingLink = '',
  notes = '',
}) => {
  try {
    const deliveryLocation = [
      shipping.address1 || shipping.address_1 || billing.address1 || billing.address_1 || '',
      shipping.city || billing.city || '',
      shipping.province || shipping.state || billing.province || billing.state || '',
      shipping.zip || shipping.postcode || billing.zip || billing.postcode || '',
      shipping.country || billing.country || '',
    ]
      .filter(Boolean)
      .join(', ') || 'N/A';

    const formattedStatus = orderStatus
      ? String(orderStatus).charAt(0).toUpperCase() + String(orderStatus).slice(1)
      : 'Processing';

    const amount =
      total !== undefined && total !== null && total !== ''
        ? `${currency || 'USD'} ${Number(total).toFixed(2)}`
        : '';

    const cleanOrderId = orderNumber
      ? String(orderNumber).startsWith('#')
        ? String(orderNumber)
        : `#${orderNumber}`
      : '';

        // If tracking info is missing in current event, check if DB order record has it saved
    let finalProvider = trackingProvider;
    let finalNumber = trackingNumber;
    let finalLink = trackingLink;

    if (!finalNumber && cleanOrderId) {
      try {
        const dbOrder = await prisma.ecommerceOrder.findFirst({
          where: { tenantId, source: 'SHOPIFY', OR: [{ orderNumber: cleanOrderId }, { externalOrderId: cleanOrderId.replace('#', '') }] }
        });
        if (dbOrder?.trackingInfo && Array.isArray(dbOrder.trackingInfo) && dbOrder.trackingInfo.length > 0) {
          finalProvider = dbOrder.trackingInfo[0].provider || finalProvider;
          finalNumber = dbOrder.trackingInfo[0].number || finalNumber;
          finalLink = dbOrder.trackingInfo[0].url || finalLink;
        }
      } catch (_) {}
    }

    await logLeadStatusToSheet(tenantId, {
      Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      'Contact Name': customerName || 'Customer',
      'Phone Number': customerPhone || '',
      'Lead Status': formattedStatus,
      'Order Status': formattedStatus,
      'Order ID': cleanOrderId,
      'Total Amount': amount,
      'Payment Status': paymentStatus || 'Pending',
      'Payment Method': paymentMethod || 'Shopify Payments',
      'Tracking Provider': finalProvider || '',
      'Tracking Number': finalNumber || '',
      'Tracking Link': finalLink || '',
      Products: itemsList || '1 Item',
      'Delivery Location': deliveryLocation,
      Notes: notes || `Shopify Order ${cleanOrderId}`,
    });

    console.log(`📊 [Shopify Sheets] Synced ${cleanOrderId} → ${formattedStatus}`);
  } catch (sheetErr) {
    console.warn(`⚠️ [Shopify Sheets] Sync failed: ${sheetErr.message}`);
  }
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY: Payment Reminder Handler (Delayed BullMQ Job)
// ─────────────────────────────────────────────────────────────
export const processShopifyPaymentReminderJob = async (data) => {
  const { tenantId, externalOrderId, orderNumber, customerPhone, customerName, orderStatusUrl, currency } = data;
  
  const currentOrder = await prisma.ecommerceOrder.findFirst({
    where: { tenantId, source: 'SHOPIFY', externalOrderId }
  });

  if (currentOrder && currentOrder.paymentStatus === 'PENDING' && currentOrder.status !== 'cancelled') {
    const { contact, conversation } = await getOrCreateShopifyContact({
      tenantId, customerPhone, customerName, customerEmail: ''
    });

    if (contact && conversation) {
      const messageText = `⏳ *Payment Reminder!* Hi ${customerName}, your order ${orderNumber} is awaiting payment. Complete it before items go out of stock here: ${orderStatusUrl || 'your order link'}`;
      await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord: currentOrder });
      console.log(`💬 [Shopify] Payment reminder sent for ${orderNumber}`);
    }

    await sendShopifyWhatsAppTemplate({
      tenantId,
      customerPhone,
      templateNamePatterns: ['payment_reminder', 'pending_payment'],
      templateParams: [orderNumber, orderStatusUrl || 'your order link']
    });
  } else {
    console.log(`⏭️ [Shopify] Payment reminder skipped for ${orderNumber}. Status is now: ${currentOrder?.paymentStatus}`);
  }
  return { success: true, type: 'SHOPIFY_REMINDER', orderNumber };
};

// ─────────────────────────────────────────────────────────────
// SHOPIFY: Order Webhook Event Router (Lifecycle Handler)
// ─────────────────────────────────────────────────────────────
export const processShopifyOrderLifecycle = async ({
  tenantId,
  topic,
  shopDomain,
  payload,
}) => {
  console.log(`\n📦 [ShopifyWorker] Processing Shopify event '${topic}' for tenant ${tenantId}`);

  if (!payload) return { ignored: true, reason: 'empty_payload' };

  // 1. Root Order Parsing & Normalization
  const rootOrder = payload.order || payload.order_edit || payload;

  const externalOrderId = String(
    payload.order_id ||
    rootOrder.order_id ||
    payload.id ||
    rootOrder.id ||
    ''
  );

  const rawOrderName =
    payload.name ||
    payload.order_number ||
    payload.order_name ||
    rootOrder.name ||
    rootOrder.order_number ||
    rootOrder.order_name ||
    null;

  let orderNumber = rawOrderName ? String(rawOrderName) : (externalOrderId ? `#${externalOrderId}` : 'Order');
  if (orderNumber && !orderNumber.startsWith('#')) orderNumber = `#${orderNumber}`;

  const financialStatus = payload.financial_status || rootOrder.financial_status || 'pending';
  const fulfillmentStatus = payload.fulfillment_status || rootOrder.fulfillment_status || 'unfulfilled';
  const status = (payload.cancelled_at || rootOrder.cancelled_at)
    ? 'cancelled'
    : (fulfillmentStatus === 'fulfilled' ? 'completed' : 'processing');
  const paymentMethod =
    payload.payment_gateway_names?.[0] ||
    rootOrder.payment_gateway_names?.[0] ||
    'Shopify Payments';
  const paymentStatus = String(financialStatus || 'pending').toUpperCase();

  const rawTotal =
    payload.current_total_price ||
    payload.total_price ||
    rootOrder.current_total_price ||
    rootOrder.total_price ||
    '0.0';
  let total = parseFloat(rawTotal || '0.0');
  const currency = payload.currency || rootOrder.currency || 'USD';

  const billing = payload.billing_address || rootOrder.billing_address || {};
  const shipping = payload.shipping_address || rootOrder.shipping_address || {};
  const customerObj = payload.customer || rootOrder.customer || {};

  let customerName = `${customerObj.first_name || billing.first_name || ''} ${customerObj.last_name || billing.last_name || ''}`.trim() || 'Customer';
  let customerEmail = customerObj.email || payload.email || billing.email || rootOrder.email || '';

  let rawPhone = customerObj.phone || billing.phone || shipping.phone || payload.phone || rootOrder.phone || '';
  let customerPhone = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : '';
  if (customerPhone && !customerPhone.startsWith('+')) customerPhone = `+${customerPhone}`;

  // 2. Line Items Normalization (Handles standard array or orders/edited additions/removals)
  const rawLineItemsSource = payload.line_items || rootOrder.line_items || [];
  let rawLineItems = [];
  if (Array.isArray(rawLineItemsSource)) {
    rawLineItems = rawLineItemsSource;
  } else if (rawLineItemsSource && typeof rawLineItemsSource === 'object') {
    const additions = Array.isArray(rawLineItemsSource.additions) ? rawLineItemsSource.additions : [];
    const removals = Array.isArray(rawLineItemsSource.removals) ? rawLineItemsSource.removals : [];
    rawLineItems = [
      ...additions.map((item) => ({
        id: item.id,
        title: item.title || item.name || `Item ${item.id || ''}`.trim(),
        name: item.title || item.name || `Item ${item.id || ''}`.trim(),
        quantity: item.quantity ?? item.delta ?? 1,
        price: item.price || '0.00',
      })),
      ...removals.map((item) => ({
        id: item.id,
        title: item.title || item.name || `Removed item ${item.id || ''}`.trim(),
        name: item.title || item.name || `Removed item ${item.id || ''}`.trim(),
        quantity: item.quantity ?? item.delta ?? 1,
        price: item.price || '0.00',
      })),
    ];
  }

  const lineItems = rawLineItems.map((item) => {
    const qty = Number(item.quantity ?? item.delta ?? 1) || 1;
    const price = parseFloat(item.price || 0) || 0;
    return {
      id: item.id,
      name: item.title || item.name || 'Product',
      quantity: qty,
      price,
      total: (price * qty).toFixed(2),
    };
  });

  const itemGroupMap = {};
  rawLineItems.forEach((item) => {
    const name = item.title || item.name || 'Product';
    const qty = Number(item.quantity ?? item.delta ?? 1) || 1;
    if (!itemGroupMap[name]) itemGroupMap[name] = qty;
    else itemGroupMap[name] += qty;
  });

  let itemsList = Object.entries(itemGroupMap)
    .map(([name, qty]) => `${name} (x${qty})`)
    .join(', ') || 'Order updated';

  // 3. Enrich sparse orders/edited payloads from DB
  if (topic === 'orders/edited' && externalOrderId) {
    try {
      const existing = await prisma.ecommerceOrder.findFirst({
        where: {
          tenantId,
          source: 'SHOPIFY',
          OR: [
            { externalOrderId: String(externalOrderId) },
            { orderNumber: orderNumber },
            { orderNumber: `#${String(externalOrderId)}` },
            { orderNumber: String(externalOrderId) },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (existing) {
        if ((!rawOrderName || orderNumber === `#${externalOrderId}` || orderNumber === 'Order') && existing.orderNumber) {
          orderNumber = existing.orderNumber.startsWith('#') ? existing.orderNumber : `#${existing.orderNumber}`;
        }
        if (!total || total === 0) {
          const t = parseFloat(existing.total ?? 0);
          if (!Number.isNaN(t) && t > 0) total = t;
        }
        if ((!customerPhone || customerPhone === '+') && existing.customerPhone) {
          customerPhone = existing.customerPhone.startsWith('+')
            ? existing.customerPhone
            : `+${String(existing.customerPhone).replace(/[^\d]/g, '')}`;
        }
        if (customerName === 'Customer' && existing.customerName) customerName = existing.customerName;
        if (!customerEmail && existing.customerEmail) customerEmail = existing.customerEmail;
        if ((!itemsList || itemsList === 'Order updated') && existing.lineItems) {
          try {
            const existingItems = Array.isArray(existing.lineItems) ? existing.lineItems : JSON.parse(existing.lineItems);
            if (Array.isArray(existingItems) && existingItems.length > 0) {
              itemsList = existingItems.map((i) => `${i.name || i.title || 'Product'} (x${i.quantity || 1})`).join(', ');
            }
          } catch (_) {}
        }
        console.log(`🧾 [Shopify] orders/edited enriched from DB order ${existing.orderNumber || existing.externalOrderId}`);
      }
    } catch (enrichErr) {
      console.warn('⚠️ [Shopify] orders/edited DB enrich failed:', enrichErr.message);
    }
  }

  // 4. Safe Database Upsert
  let orderRecord = null;
  try {
    const orderKey = {
      tenantId_source_externalOrderId: {
        tenantId,
        source: 'SHOPIFY',
        externalOrderId
      }
    };

    const baseUpdate = { status, paymentMethod, paymentStatus };
    if (topic !== 'orders/edited') {
      Object.assign(baseUpdate, { total, customerName, customerPhone, customerEmail, shippingAddress: shipping, lineItems, orderNumber });
    } else {
      if (total && total > 0) baseUpdate.total = total;
      if (customerName && customerName !== 'Customer') baseUpdate.customerName = customerName;
      if (customerPhone && customerPhone !== '+') baseUpdate.customerPhone = customerPhone;
      if (customerEmail) baseUpdate.customerEmail = customerEmail;
      if (shipping && Object.keys(shipping).length > 0) baseUpdate.shippingAddress = shipping;
      if (Array.isArray(lineItems) && lineItems.length > 0) baseUpdate.lineItems = lineItems;
      if (orderNumber && orderNumber !== 'Order' && !orderNumber.match(/^#?\d{10,}$/)) baseUpdate.orderNumber = orderNumber;
    }

    orderRecord = await prisma.ecommerceOrder.upsert({
      where: orderKey,
      update: baseUpdate,
      create: {
        tenantId, source: 'SHOPIFY', externalOrderId, orderNumber,
        status, paymentMethod, paymentStatus, total: total || 0, currency, customerName,
        customerPhone, customerEmail, shippingAddress: shipping, lineItems
      }
    });
    console.log(`✅ [ShopifyWorker] EcommerceOrder stored in DB (ID: ${orderRecord.id})`);
  } catch (dbErr) {
    console.warn(`ℹ️ [ShopifyWorker] EcommerceOrder upsert notice: ${dbErr.message}`);
  }

  // 5. Topic Routing (Messages, WA Templates, Google Sheets)
  const storeName = shopDomain || 'our store';

    switch (topic) {

       // ── 0. ABANDONED CART CHECKOUT ─────────────────────────────
    case 'carts/create':
    case 'carts/update':
    case 'checkouts/create':
    case 'checkouts/update': {
      console.log(`🛒 [Shopify Lifecycle] Received ${topic} for tenant ${tenantId}`);
      const result = await handleCheckoutUpdate(tenantId, payload);
      return { success: true, type: 'SHOPIFY_CHECKOUT', result };
    }

    // ── 1.1 ORDER CONFIRMATION & 2.3 PAYMENT REMINDER ──────────────
    case 'orders/create': {
      // Cancel any pending abandoned cart reminders since the customer purchased!
      const checkoutId = payload.checkout_id || rootOrder.checkout_id || externalOrderId;
      if (checkoutId) {
        cancelCartReminders(tenantId, String(checkoutId)).catch((err) =>
          console.warn('⚠️ [Shopify] Failed to cancel cart reminders:', err.message)
        );
      }
      if (await isShopifyEventDuplicate(tenantId, externalOrderId, 'orders/create')) {
        console.log(`⏭️ [Shopify] Duplicate orders/create skipped for #${orderNumber}`);
        break;
      }

      const { contact, conversation } = await getOrCreateShopifyContact({
        tenantId, customerPhone, customerName, customerEmail
      });

      if (contact && conversation) {
        const messageText = `🎉 *Order Confirmed!* Hi ${customerName}, thank you for your order ${orderNumber} totaling ${currency} ${total.toFixed(2)} at ${storeName}. Items: ${itemsList || '1 Item'}. We are preparing your shipment! 🛍️`;
        await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
        console.log(`💬 [Shopify] Order confirmation saved to inbox for ${customerPhone}`);
      }

      await sendShopifyWhatsAppTemplate({
        tenantId,
        customerPhone,
        templateNamePatterns: ['order_confirm', 'order_confirmation', 'order'],
        templateParams: [customerName, orderNumber, `${currency} ${total.toFixed(2)}`, itemsList || '1 Item']
      });

      await recordShopifyEvent(tenantId, externalOrderId, 'orders/create');

      await logShopifyOrderToSheet({
        tenantId, customerName, customerPhone, orderNumber,
        orderStatus: 'Order Received', paymentStatus: paymentStatus === 'PAID' ? 'Paid' : 'Pending',
        paymentMethod, currency, total, itemsList, shipping, billing,
        notes: `Shopify Order ${orderNumber} created`
      });

      if (financialStatus === 'pending') {
        const orderStatusUrl = payload.order_status_url || rootOrder.order_status_url || '';
        await orderWebhookQueue.add(
          'shopify-payment-reminder',
          { tenantId, externalOrderId, orderNumber, customerPhone, customerName, orderStatusUrl, currency },
          { delay: 300000 } // 5 minutes delay for testing (use 3600000 for 1 hr in prod)
        );
        console.log(`⏱️ [Shopify] Enqueued payment reminder for ${orderNumber} in 5 minutes.`);
      }
      break;
    }

    // ── 1.2 & 2.X PAYMENT UPDATES (SUCCESS, FAILED, REFUNDS) ────────
    case 'orders/updated': {
      const { contact, conversation } = await getOrCreateShopifyContact({
        tenantId, customerPhone, customerName, customerEmail
      });

      // 1. Refunds (Full & Partial)
      const refunds = payload.refunds || rootOrder.refunds || [];
      for (const refund of refunds) {
        if (await isShopifyEventDuplicate(tenantId, refund.id, 'refund_processed')) continue;

        let refundTotal = 0;
        if (Array.isArray(refund.transactions)) {
          refundTotal = refund.transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        }
        if (refundTotal === 0 && Array.isArray(refund.refund_line_items)) {
          refundTotal = refund.refund_line_items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
        }

        const isPartial = financialStatus === 'partially_refunded' || (financialStatus !== 'refunded' && refundTotal < total);

        if (contact && conversation && refundTotal > 0) {
          const messageText = isPartial
            ? `💸 *Partial Refund.* Hi ${customerName}, a partial refund of ${currency} ${refundTotal.toFixed(2)} for order ${orderNumber} has been processed.`
            : `💰 *Refund Completed.* Hi ${customerName}, a refund of ${currency} ${refundTotal.toFixed(2)} for order ${orderNumber} has been credited to your account. ✅`;

          await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
          console.log(`💬 [Shopify] Refund notification saved to inbox for ${customerPhone}`);
        }

        await sendShopifyWhatsAppTemplate({
          tenantId,
          customerPhone,
          templateNamePatterns: isPartial ? ['partial_refund', 'refund'] : ['refund_completed', 'refund'],
          templateParams: [orderNumber, `${currency} ${refundTotal.toFixed(2)}`]
        });

        await recordShopifyEvent(tenantId, refund.id, 'refund_processed');

        await logShopifyOrderToSheet({
          tenantId, customerName, customerPhone, orderNumber,
          orderStatus: isPartial ? 'Partially Refunded' : 'Refunded',
          paymentStatus: isPartial ? 'Partially Refunded' : 'Refunded',
          paymentMethod, currency, total: refundTotal > 0 ? refundTotal : total,
          itemsList, shipping, billing,
          notes: `Shopify ${isPartial ? 'partial' : 'full'} refund ${currency} ${refundTotal.toFixed(2)}`
        });
      }

      // 2. Payment Success
      if (financialStatus === 'paid' && !(await isShopifyEventDuplicate(tenantId, externalOrderId, 'payment_received'))) {
        if (contact && conversation) {
          const messageText = `✅ *Payment Received!* Hi ${customerName}, payment of ${currency} ${total.toFixed(2)} for order ${orderNumber} has been confirmed. Thank you! 💳`;
          await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
          console.log(`💬 [Shopify] Payment confirmation saved to inbox for ${customerPhone}`);
        }
        await sendShopifyWhatsAppTemplate({
          tenantId,
          customerPhone,
          templateNamePatterns: ['payment_received', 'payment'],
          templateParams: [orderNumber, `${currency} ${total.toFixed(2)}`]
        });
        await recordShopifyEvent(tenantId, externalOrderId, 'payment_received');

        await logShopifyOrderToSheet({
          tenantId, customerName, customerPhone, orderNumber,
          orderStatus: 'Confirmed', paymentStatus: 'Paid',
          paymentMethod, currency, total, itemsList, shipping, billing,
          notes: `Shopify payment received for ${orderNumber}`
        });
      }

      // 3. Payment Failed / Voided
      if (['voided', 'expired'].includes(financialStatus) && !(await isShopifyEventDuplicate(tenantId, externalOrderId, 'payment_failed'))) {
        const orderStatusUrl = payload.order_status_url || rootOrder.order_status_url || '';
        if (contact && conversation) {
          const messageText = `⚠️ *Payment Failed.* Hi ${customerName}, payment for order ${orderNumber} failed. Please retry here: ${orderStatusUrl || 'your order link'}`;
          await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
        }
        await sendShopifyWhatsAppTemplate({
          tenantId,
          customerPhone,
          templateNamePatterns: ['payment_failed', 'failed'],
          templateParams: [orderNumber, orderStatusUrl || 'your order link']
        });
        await recordShopifyEvent(tenantId, externalOrderId, 'payment_failed');

        await logShopifyOrderToSheet({
          tenantId, customerName, customerPhone, orderNumber,
          orderStatus: 'Payment Failed', paymentStatus: 'Failed',
          paymentMethod, currency, total, itemsList, shipping, billing,
          notes: `Shopify payment ${financialStatus} for ${orderNumber}`
        });
      }
      break;
    }

    // ── 1.3 ORDER SHIPPED ──────────────────────────────────
    case 'orders/fulfilled': {
      if (await isShopifyEventDuplicate(tenantId, externalOrderId, 'orders/fulfilled')) {
        console.log(`⏭️ [Shopify] Duplicate orders/fulfilled skipped for #${orderNumber}`);
        break;
      }

      const { contact, conversation } = await getOrCreateShopifyContact({
        tenantId, customerPhone, customerName, customerEmail
      });

      const fulfillment = payload.fulfillments?.[0] || payload.fulfillment || payload || {};
      const trackingNumber = fulfillment.tracking_number || fulfillment.tracking_numbers?.[0] || payload.tracking_number || 'N/A';
      const trackingUrl = fulfillment.tracking_url || fulfillment.tracking_urls?.[0] || payload.tracking_url || '';
      const trackingCompany = fulfillment.tracking_company || fulfillment.company || payload.tracking_company || 'Courier';

      if (contact && conversation) {
        const messageText = `🚚 *Order Shipped!* Hi ${customerName}, your order ${orderNumber} has been shipped! ${trackingCompany ? `Courier: ${trackingCompany}. ` : ''}Tracking: ${trackingNumber}${trackingUrl ? `. Track here: ${trackingUrl}` : ''}`;
        await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
        console.log(`💬 [Shopify] Shipping notification saved to inbox for ${customerPhone}`);
      }

      await sendShopifyWhatsAppTemplate({
        tenantId,
        customerPhone,
        templateNamePatterns: ['order_shipped', 'shipment', 'shipping'],
        templateParams: [orderNumber, trackingNumber, trackingUrl || 'N/A']
      });

      await recordShopifyEvent(tenantId, externalOrderId, 'orders/fulfilled');

      await logShopifyOrderToSheet({
        tenantId, customerName, customerPhone, orderNumber,
        orderStatus: 'Shipped', paymentStatus: paymentStatus === 'PAID' ? 'Paid' : paymentStatus,
        paymentMethod, currency, total, itemsList, shipping, billing,
        trackingProvider: trackingCompany, trackingNumber: trackingNumber !== 'N/A' ? trackingNumber : '', trackingLink: trackingUrl,
        notes: `Shopify order ${orderNumber} shipped`
      });
      break;
    }

    // ── 1.6 ORDER CANCELLED ────────────────────────────────
    case 'orders/cancelled': {
      if (await isShopifyEventDuplicate(tenantId, externalOrderId, 'orders/cancelled')) {
        console.log(`⏭️ [Shopify] Duplicate orders/cancelled skipped for #${orderNumber}`);
        break;
      }

      const { contact, conversation } = await getOrCreateShopifyContact({
        tenantId, customerPhone, customerName, customerEmail
      });

      const cancelReason = payload.cancel_reason || 'your request';

      if (contact && conversation) {
        const messageText = `❌ *Order Cancelled.* Hi ${customerName}, your order ${orderNumber} has been cancelled as per ${cancelReason}. Refund will be processed in 3-5 business days.`;
        await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
        console.log(`💬 [Shopify] Cancellation notification saved to inbox for ${customerPhone}`);
      }

      await sendShopifyWhatsAppTemplate({
        tenantId,
        customerPhone,
        templateNamePatterns: ['order_cancelled', 'cancel'],
        templateParams: [orderNumber, cancelReason]
      });

      await recordShopifyEvent(tenantId, externalOrderId, 'orders/cancelled');

      await logShopifyOrderToSheet({
        tenantId, customerName, customerPhone, orderNumber,
        orderStatus: 'Cancelled', paymentStatus: paymentStatus === 'PAID' ? 'Paid' : paymentStatus,
        paymentMethod, currency, total, itemsList, shipping, billing,
        notes: `Shopify order cancelled: ${cancelReason}`
      });
      break;
    }

    // ── 1.7 ORDER EDITED ───────────────────────────────────
    case 'orders/edited': {
      if (await isShopifyEventDuplicate(tenantId, externalOrderId, 'orders/edited')) {
        console.log(`⏭️ [Shopify] Duplicate orders/edited skipped for #${orderNumber}`);
        break;
      }

      const { contact, conversation } = await getOrCreateShopifyContact({
        tenantId, customerPhone, customerName, customerEmail
      });

      if (contact && conversation) {
        const messageText = `✏️ *Order Updated.* Hi ${customerName}, your order ${orderNumber} has been updated. New total: ${currency} ${total.toFixed(2)}. Items: ${itemsList || '1 Item'}.`;
        await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
        console.log(`💬 [Shopify] Edit notification saved to inbox for ${customerPhone}`);
      }

      await sendShopifyWhatsAppTemplate({
        tenantId,
        customerPhone,
        templateNamePatterns: ['order_edited', 'order_update', 'edit'],
        templateParams: [orderNumber, `${currency} ${total.toFixed(2)}`]
      });

      await recordShopifyEvent(tenantId, externalOrderId, 'orders/edited');

      await logShopifyOrderToSheet({
        tenantId, customerName, customerPhone, orderNumber,
        orderStatus: 'Order Updated', paymentStatus: paymentStatus === 'PAID' ? 'Paid' : paymentStatus,
        paymentMethod, currency, total, itemsList, shipping, billing,
        notes: `Shopify order ${orderNumber} edited`
      });
      break;
    }

    // ── 1.4 & 1.5 FULFILLMENT EVENTS ───────────────────────
    case 'fulfillment_events/create': {
      const fStatus = payload.status || '';
      const eventSubType = fStatus === 'out_for_delivery' ? 'out_for_delivery' :
                           fStatus === 'delivered' ? 'delivered' : null;

      if (!eventSubType) {
        console.log(`⏭️ [Shopify] fulfillment_events/create with status '${fStatus}' — not handled.`);
        break;
      }

      if (await isShopifyEventDuplicate(tenantId, externalOrderId, eventSubType)) {
        console.log(`⏭️ [Shopify] Duplicate ${eventSubType} skipped for #${orderNumber}`);
        break;
      }

      const { contact, conversation } = await getOrCreateShopifyContact({
        tenantId, customerPhone, customerName, customerEmail
      });

      if (contact && conversation) {
        const messageText = eventSubType === 'out_for_delivery'
          ? `🏠 *Out for Delivery!* Hi ${customerName}, your order ${orderNumber} is out for delivery today! Be ready to receive it.`
          : `✅ *Delivered!* Hi ${customerName}, your order ${orderNumber} has been delivered! Hope you love it. 🎉`;
        await saveShopifyInboxMessage({ tenantId, conversation, contact, messageText, orderRecord });
        console.log(`💬 [Shopify] ${eventSubType} notification saved to inbox for ${customerPhone}`);
      }

      await sendShopifyWhatsAppTemplate({
        tenantId,
        customerPhone,
        templateNamePatterns: eventSubType === 'out_for_delivery'
          ? ['out_for_delivery', 'delivery']
          : ['order_delivered', 'delivered'],
        templateParams: [orderNumber]
      });

      await recordShopifyEvent(tenantId, externalOrderId, eventSubType);

      await logShopifyOrderToSheet({
        tenantId, customerName, customerPhone, orderNumber,
        orderStatus: eventSubType === 'out_for_delivery' ? 'Out for Delivery' : 'Delivered',
        paymentStatus: paymentStatus === 'PAID' ? 'Paid' : paymentStatus,
        paymentMethod, currency, total, itemsList, shipping, billing,
        notes: eventSubType === 'out_for_delivery' ? `Shopify order ${orderNumber} out for delivery` : `Shopify order ${orderNumber} delivered`
      });
      break;
    }

    default:
      console.log(`ℹ️ [Shopify] Unhandled topic: ${topic} for order #${orderNumber}`);
  }

  return { success: true, type: 'SHOPIFY', orderNumber, topic };
};
import prisma from '../../config/prisma.js';
import { sendMessageService } from '../messages/messageService.js';

// Default templates with business-customizable placeholders
const DEFAULT_1H_TEMPLATE = `Hi {{customer_name}}, you left items in your cart at {{store_name}}! 🛒

Order total: {{currency}} {{total_amount}}

Complete your purchase here before items sell out:
🔗 {{checkout_url}}`;

const DEFAULT_24H_TEMPLATE = `Hi {{customer_name}}, your reserved items at {{store_name}} are selling fast! ⏳

Don't miss out on your order (Total: {{currency}} {{total_amount}}).

Click below to complete checkout now:
🔗 {{checkout_url}}`;

/**
 * Replace placeholders in template text
 */
function renderMessage(template, vars) {
  let result = template || '';
  Object.keys(vars).forEach((key) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, vars[key] || '');
  });
  return result;
}

/**
 * Process abandoned cart reminders for 1h and 24h windows
 */
export async function processAbandonedCartReminders() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  console.log('🛒 [Cart Recovery] Scanning for abandoned carts...');

  // 1. Fetch orders in 1-Hour window (created 1h to 24h ago, reminder 1 not sent)
  const orders1h = await prisma.ecommerceOrder.findMany({
    where: {
      status: { in: ['pending', 'failed', 'on-hold', 'wc-pending', 'wc-failed'] },
      createdAt: { lte: oneHourAgo, gte: twentyFourHoursAgo },
      cartReminder1SentAt: null,
    },
    take: 50,
  });

  for (const order of orders1h) {
    try {
      await sendCartReminder(order, 1);
    } catch (err) {
      console.error(`❌ [Cart Recovery] Failed sending 1h reminder for order #${order.orderNumber || order.id}:`, err.message);
    }
  }

  // 2. Fetch orders in 24-Hour window (created 24h to 48h ago, reminder 24 not sent)
  const orders24h = await prisma.ecommerceOrder.findMany({
    where: {
      status: { in: ['pending', 'failed', 'on-hold', 'wc-pending', 'wc-failed'] },
      createdAt: { lte: twentyFourHoursAgo, gte: fortyEightHoursAgo },
      cartReminder24SentAt: null,
    },
    take: 50,
  });

  for (const order of orders24h) {
    try {
      await sendCartReminder(order, 24);
    } catch (err) {
      console.error(`❌ [Cart Recovery] Failed sending 24h reminder for order #${order.orderNumber || order.id}:`, err.message);
    }
  }
}

/**
 * Send a specific cart reminder (1h or 24h) for an order
 */
async function sendCartReminder(order, hours) {
  if (!order.customerPhone) return;

  // Get tenant info
  const tenant = await prisma.tenant.findUnique({
    where: { id: order.tenantId },
    select: { id: true, tenantName: true },
  });
  if (!tenant) return;

  // Get WooCommerce connection settings & templates
  const wooConn = await prisma.wooCommerceConnection.findFirst({
    where: { tenantId: tenant.id },
  });

  // Extract store URL
  let storeUrl = wooConn?.wpUrl ? wooConn.wpUrl.replace(/\/+$/, '') : '';
  
  // Fallback: extract domain if permalink exists in order payload
  if (!storeUrl && order.permalink) {
    try {
      const urlObj = new URL(order.permalink);
      storeUrl = urlObj.origin;
    } catch (_) {}
  }

  const wooOrderId = order.wooOrderId || order.orderNumber || order.id;
  
  // Extract order_key from raw payload or metadata if present
  const rawPayload = order.rawPayload || {};
  const orderMetadata = order.orderMetadata || {};
  const orderKey = order.orderKey || rawPayload.order_key || orderMetadata.order_key || '';

  // Build checkout payment URL
  let checkoutUrl = '';
  if (storeUrl) {
    checkoutUrl = orderKey
      ? `${storeUrl}/checkout/order-pay/${wooOrderId}/?pay_for_order=true&key=${orderKey}`
      : `${storeUrl}/checkout/order-pay/${wooOrderId}/?pay_for_order=true`;
  } else {
    checkoutUrl = `Order #${wooOrderId}`;
  }

  // Select message template
  let templateText = '';
  if (hours === 1) {
    templateText = wooConn?.cartReminder1Text || DEFAULT_1H_TEMPLATE;
  } else {
    templateText = wooConn?.cartReminder24Text || DEFAULT_24H_TEMPLATE;
  }

  // Render variables
  const messageBody = renderMessage(templateText, {
    customer_name: order.customerName || 'Customer',
    store_name: tenant.tenantName || 'our store',
    total_amount: order.totalAmount || '0.00',
    currency: order.currency || 'INR',
    checkout_url: checkoutUrl,
  });

  // Find or create Contact
  const cleanPhone = String(order.customerPhone).replace(/\D/g, '');
  let contact = await prisma.contact.findFirst({
    where: { tenantId: tenant.id, phone: cleanPhone },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        phone: cleanPhone,
        name: order.customerName || 'WooCommerce Customer',
      },
    });
  }

  console.log(`💬 [Cart Recovery] Sending ${hours}h reminder for Order #${wooOrderId} to ${cleanPhone}...`);

  // Send WhatsApp message
  await sendMessageService({
    tenantId: tenant.id,
    contactId: contact.id,
    type: 'text',
    text: messageBody,
    senderType: 'SYSTEM',
  });

  // Mark reminder as sent in database
  const updateData = hours === 1 
    ? { cartReminder1SentAt: new Date() } 
    : { cartReminder24SentAt: new Date() };

  await prisma.ecommerceOrder.update({
    where: { id: order.id },
    data: updateData,
  });

  console.log(`✅ [Cart Recovery] ${hours}h reminder sent successfully for Order #${wooOrderId}`);
}
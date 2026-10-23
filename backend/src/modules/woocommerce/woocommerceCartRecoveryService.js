import axios from 'axios';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import { sendMessageService } from '../messages/messageService.js';

const REMINDER_TIERS = ['1h', '24h', '48h'];
const SENT_FIELDS = {
  '1h': 'cartReminder1SentAt',
  '24h': 'cartReminder24SentAt',
  '48h': 'cartReminder48SentAt',
};
const ENABLED_FIELDS = {
  '1h': 'cartReminder1Enabled',
  '24h': 'cartReminder24Enabled',
  '48h': 'cartReminder48Enabled',
};

const DEFAULT_TEMPLATES = {
  '1h': `Hi {{customer_name}}, you left items in your cart at {{store_name}}! 🛒

{{product_summary}}
Order total: {{currency}} {{total_amount}}

Complete your purchase here:
{{checkout_url}}`,
  '24h': `Hi {{customer_name}}, your cart is waiting at {{store_name}}! ⏳

{{product_summary}}
Order total: {{currency}} {{total_amount}}

Complete your checkout:
{{checkout_url}}`,
  '48h': `Hi {{customer_name}}, don't miss the items in your cart at {{store_name}}!

{{product_summary}}
Order total: {{currency}} {{total_amount}}

Use {{discount_code}} for {{discount_label}} off.
Complete your checkout:
{{checkout_url}}`,
};

const renderMessage = (template, variables) => Object.entries(variables).reduce(
  (text, [key, value]) => text.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value ?? '')),
  template || '',
);

const cleanPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
};

const recoveryJobId = (tenantId, cartId, tier) =>
  `woo_cart_${tier}_${tenantId}_${Buffer.from(cartId).toString('hex').slice(0, 48)}`;

export async function handleWooCommerceCartEvent({ tenantId, event }) {
  const cartId = String(event.cartId || '');
  const customerPhone = cleanPhone(event.customer?.phone);
  if (event.topic === 'cart.converted') {
    if (customerPhone) {
      await prisma.ecommerceOrder.upsert({
        where: {
          tenantId_source_externalOrderId: {
            tenantId,
            source: 'WOOCOMMERCE',
            externalOrderId: `cart_${cartId}`,
          },
        },
        update: { cartStatus: 'converted' },
        create: {
          tenantId,
          source: 'WOOCOMMERCE',
          externalOrderId: `cart_${cartId}`,
          orderNumber: `CART-${cartId}`.slice(0, 100),
          status: 'converted',
          paymentStatus: 'PAID',
          customerPhone,
          lineItems: [],
          cartStatus: 'converted',
        },
      });
    }
    await cancelWooCartReminders(tenantId, cartId);
    return { success: true, cartId, converted: true };
  }

  if (!cartId || !customerPhone) {
    return { skipped: true, reason: !cartId ? 'no_cart_id' : 'no_phone' };
  }

  const connection = await prisma.wooCommerceConnection.findUnique({
    where: { tenantId },
    select: { storeUrl: true, cartRecoveryEnabled: true },
  });
  if (!connection || connection.cartRecoveryEnabled === false) {
    return { skipped: true, reason: 'disabled_or_disconnected' };
  }

  const matchingOrder = await prisma.ecommerceOrder.findFirst({
    where: {
      tenantId,
      source: 'WOOCOMMERCE',
      cartRecoveryId: cartId,
    },
    select: { id: true },
  });
  if (matchingOrder) {
    await cancelWooCartReminders(tenantId, cartId);
    return { skipped: true, reason: 'already_converted' };
  }

  const recoveryId = `cart_${cartId}`;
  const existingCart = await prisma.ecommerceOrder.findUnique({
    where: {
      tenantId_source_externalOrderId: {
        tenantId,
        source: 'WOOCOMMERCE',
        externalOrderId: recoveryId,
      },
    },
    select: { cartStatus: true },
  });
  if (existingCart?.cartStatus === 'converted' || existingCart?.cartStatus === 'recovered') {
    return { skipped: true, reason: 'cart_already_converted' };
  }
  const lineItems = event.cart?.lineItems || [];
  const total = Number(event.cart?.total);
  const currency = String(event.cart?.currency || 'USD').slice(0, 8);
  const checkoutUrl = String(event.cart?.checkoutUrl || '');
  const productSummary = lineItems
    .map((item) => `${item.name} (x${item.quantity})`)
    .join(', ')
    .slice(0, 2000) || 'Items in your cart';

  const order = await prisma.ecommerceOrder.upsert({
    where: {
      tenantId_source_externalOrderId: {
        tenantId,
        source: 'WOOCOMMERCE',
        externalOrderId: recoveryId,
      },
    },
    update: {
      customerName: String(event.customer?.name || 'Customer').slice(0, 100),
      customerPhone,
      customerEmail: String(event.customer?.email || '').slice(0, 254),
      total: Number.isFinite(total) ? total : 0,
      currency,
      lineItems,
      status: 'abandoned',
      paymentStatus: 'UNPAID',
      cartStatus: 'abandoned',
      cartReminder1SentAt: null,
      cartReminder24SentAt: null,
      cartReminder48SentAt: null,
    },
    create: {
      tenantId,
      source: 'WOOCOMMERCE',
      externalOrderId: recoveryId,
      orderNumber: `CART-${cartId}`.slice(0, 100),
      status: 'abandoned',
      paymentStatus: 'UNPAID',
      total: Number.isFinite(total) ? total : 0,
      currency,
      customerName: String(event.customer?.name || 'Customer').slice(0, 100),
      customerPhone,
      customerEmail: String(event.customer?.email || '').slice(0, 254),
      lineItems,
      cartStatus: 'abandoned',
    },
  });

  await scheduleWooCartReminders({
    tenantId,
    cartId,
    cartOrderId: order.id,
    customerPhone,
    customerName: event.customer?.name || 'Customer',
    customerEmail: event.customer?.email || '',
    total: Number.isFinite(total) ? total : 0,
    currency,
    lineItems,
    productSummary,
    productImageUrl: lineItems[0]?.imageUrl || null,
    checkoutUrl,
    storeUrl: connection.storeUrl,
  });

  console.log(`[Woo Cart Recovery] Saved cart ${cartId} and scheduled reminders for tenant ${tenantId}`);
  return { success: true, cartId, cartOrderId: order.id };
}

async function scheduleWooCartReminders(data) {
  const connection = await prisma.wooCommerceConnection.findUnique({
    where: { tenantId: data.tenantId },
    select: {
      cartRecoveryEnabled: true,
      cartReminder1Enabled: true,
      cartReminder24Enabled: true,
      cartReminder48Enabled: true,
    },
  });
  if (!connection || connection.cartRecoveryEnabled === false) return;

  const delayByTier = process.env.NODE_ENV === 'production'
    ? { '1h': 60 * 60_000, '24h': 24 * 60 * 60_000, '48h': 48 * 60 * 60_000 }
    : { '1h': 10_000, '24h': 30_000, '48h': 60_000 };

  for (const tier of REMINDER_TIERS) {
    if (connection[ENABLED_FIELDS[tier]] === false) continue;

    const jobId = recoveryJobId(data.tenantId, data.cartId, tier);
    const existing = await orderWebhookQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active') continue;
      await existing.remove();
    }

    await orderWebhookQueue.add(
      `woo-cart-${tier}`,
      { ...data, tier },
      {
        jobId,
        delay: delayByTier[tier],
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
  }
}

export async function cancelWooCartReminders(tenantId, cartId) {
  if (!tenantId || !cartId) return { cancelled: 0 };

  let cancelled = 0;
  for (const tier of REMINDER_TIERS) {
    const job = await orderWebhookQueue.getJob(recoveryJobId(tenantId, cartId, tier));
    if (!job) continue;
    try {
      await job.remove();
      cancelled += 1;
    } catch (error) {
      console.warn(`[Woo Cart Recovery] Could not cancel ${tier} job for cart ${cartId}: ${error.message}`);
    }
  }

  await prisma.ecommerceOrder.updateMany({
    where: {
      tenantId,
      source: 'WOOCOMMERCE',
      externalOrderId: `cart_${cartId}`,
      cartStatus: 'abandoned',
    },
    data: { cartStatus: 'converted' },
  });
  return { cancelled };
}

export async function processCartReminder(data) {
  const { tenantId, cartId, tier } = data;
  const sentField = SENT_FIELDS[tier];
  if (!sentField) return { skipped: true, reason: 'unknown_tier' };

  const [connection, cart] = await Promise.all([
    prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
      select: {
        storeUrl: true,
        cartRecoveryEnabled: true,
        cartReminder1Enabled: true,
        cartReminder24Enabled: true,
        cartReminder48Enabled: true,
        cartReminder1Text: true,
        cartReminder24Text: true,
        cartReminder48Text: true,
        cartDiscountCode: true,
        cartDiscountLabel: true,
        cartIncludeImage: true,
      },
    }),
    prisma.ecommerceOrder.findUnique({
      where: {
        tenantId_source_externalOrderId: {
          tenantId,
          source: 'WOOCOMMERCE',
          externalOrderId: `cart_${cartId}`,
        },
      },
    }),
  ]);

  if (!connection || connection.cartRecoveryEnabled === false
    || connection[ENABLED_FIELDS[tier]] === false) {
    return { skipped: true, reason: 'disabled' };
  }
  if (!cart || cart.cartStatus !== 'abandoned') {
    return { skipped: true, reason: 'cart_not_abandoned' };
  }
  if (cart[sentField]) return { skipped: true, reason: 'already_sent' };

  const customerPhone = cleanPhone(data.customerPhone || cart.customerPhone);
  if (!customerPhone) return { skipped: true, reason: 'no_phone' };
  let recipient = customerPhone;
  if (process.env.NODE_ENV !== 'production'
    && process.env.SHOPIFY_OVERRIDE_PHONE_IN_DEV === 'true') {
    recipient = cleanPhone(process.env.META_TEST_PHONE);
    if (!recipient) {
      throw new Error('META_TEST_PHONE must be a valid phone number when the development recipient override is enabled');
    }
    console.log(`[Woo Cart Recovery] Development recipient override active for cart ${cartId}`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, tenantName: true, whatsappPhoneId: true, whatsappAccessToken: true },
  });
  if (!tenant) return { skipped: true, reason: 'tenant_not_found' };

  let contact = await prisma.contact.findFirst({
    where: { tenantId, phone: recipient },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        phone: recipient,
        name: data.customerName || cart.customerName || 'WooCommerce Customer',
        email: data.customerEmail || cart.customerEmail || undefined,
      },
    });
  }
  let conversation = await prisma.conversation.findFirst({
    where: { tenantId, contactId: contact.id },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { tenantId, contactId: contact.id, status: 'OPEN' },
    });
  }

  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const summary = data.productSummary || lineItems
    .map((item) => `${item.name} (x${item.quantity})`)
    .join(', ') || 'Items in your cart';
  const cartData = {
    customerName: data.customerName || cart.customerName || 'Customer',
    total: Number(data.total ?? cart.total ?? 0),
    currency: data.currency || cart.currency || 'USD',
    productSummary: summary,
    checkoutUrl: data.checkoutUrl,
    productImageUrl: data.productImageUrl || lineItems[0]?.imageUrl || null,
  };
  const settings = {
    storeName: tenant.tenantName || 'our store',
    cartDiscountCode: connection.cartDiscountCode || 'CART10',
    cartDiscountLabel: connection.cartDiscountLabel || '10%',
    cartIncludeImage: connection.cartIncludeImage !== false,
  };
  const body = renderMessage(connection[{
    '1h': 'cartReminder1Text',
    '24h': 'cartReminder24Text',
    '48h': 'cartReminder48Text',
  }[tier]] || DEFAULT_TEMPLATES[tier], {
    customer_name: cartData.customerName,
    store_name: settings.storeName,
    product_summary: cartData.productSummary,
    total_amount: cartData.total.toFixed(2),
    currency: cartData.currency,
    checkout_url: cartData.checkoutUrl,
    discount_code: settings.cartDiscountCode,
    discount_label: settings.cartDiscountLabel,
  });

  if (process.env.NODE_ENV !== 'production') {
    await sendMessageService({
      tenantId,
      contactId: contact.id,
      senderId: 'SYSTEM',
      senderType: 'SYSTEM',
      text: body,
    });
    if (settings.cartIncludeImage && cartData.productImageUrl) {
      await sendMessageService({
        tenantId,
        contactId: contact.id,
        senderId: 'SYSTEM',
        senderType: 'SYSTEM',
        type: 'image',
        mediaUrl: cartData.productImageUrl,
        fileUrl: cartData.productImageUrl,
        caption: `${cartData.productSummary}\n${cartData.currency} ${cartData.total.toFixed(2)}`,
      });
    }
  } else {
    await sendApprovedCartTemplate({
      tenantId,
      tenant,
      recipient,
      tier,
      cartData,
      settings,
      conversation,
    });
  }

  await prisma.ecommerceOrder.update({
    where: { id: cart.id },
    data: { [sentField]: new Date() },
  });
  return { success: true, cartId, tier, to: recipient };
}

async function sendApprovedCartTemplate({
  tenantId,
  tenant,
  recipient,
  tier,
  cartData,
  settings,
  conversation,
}) {
  const phoneNumberId = tenant.whatsappPhoneId;
  const accessToken = tenant.whatsappAccessToken ? decrypt(tenant.whatsappAccessToken) : null;
  if (!phoneNumberId || !accessToken) {
    throw new Error(`WhatsApp sender is not connected for tenant ${tenantId}`);
  }

  const names = {
    '1h': ['cart_reminder_1h', 'cart_reminder_1hr', 'abandoned_cart_1h', 'cart_1h'],
    '24h': ['cart_reminder_24h', 'cart_reminder_24hr', 'abandoned_cart_24h', 'cart_24h'],
    '48h': ['cart_reminder_48h', 'cart_reminder_48hr', 'abandoned_cart_48h', 'cart_48h', 'cart_discount'],
  }[tier];
  const nameFilters = names.map((name) => ({ name: { contains: name } }));
  let template = null;
  if (settings.cartIncludeImage && cartData.productImageUrl) {
    template = await prisma.template.findFirst({
      where: { tenantId, status: 'APPROVED', headerType: 'IMAGE', OR: nameFilters },
    });
  }
  template ||= await prisma.template.findFirst({
    where: { tenantId, status: 'APPROVED', OR: nameFilters },
  });
  if (!template) throw new Error(`No approved WhatsApp cart template found for ${tier}`);

  const bodyComponent = template.components?.find(
    (component) => String(component.type).toUpperCase() === 'BODY',
  );
  const indices = [...new Set([...(bodyComponent?.text || '').matchAll(/\{\{(\d+)\}\}/g)]
    .map((match) => Number(match[1])))].sort((a, b) => a - b);
  const values = [
    cartData.customerName,
    cartData.productSummary,
    cartData.currency,
    cartData.total.toFixed(2),
    cartData.checkoutUrl,
  ];
  if (tier === '48h') values.push(settings.cartDiscountCode, settings.cartDiscountLabel);
  const count = indices.length || template.bodyParams || 0;
  if (count > values.length || indices.some((index, position) => index !== position + 1)) {
    throw new Error(`Template "${template.name}" has unsupported body placeholders`);
  }
  const components = [];
  if (settings.cartIncludeImage && cartData.productImageUrl && template.headerType === 'IMAGE') {
    components.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: cartData.productImageUrl } }],
    });
  }
  const bodyParams = indices.length
    ? indices.map((index) => values[index - 1] ?? '')
    : values.slice(0, count);
  if (bodyParams.length) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) })),
    });
  }
  const buttons = (template.buttons || []).filter(
    (button) => String(button.type).toUpperCase() !== 'QUICK_REPLY',
  );
  const urlButtonIndex = buttons.findIndex(
    (button) => String(button.type).toUpperCase() === 'URL' && /\{\{1\}\}/.test(button.url || ''),
  );
  if (urlButtonIndex >= 0) {
    const url = buttons[urlButtonIndex].url;
    const prefix = url.slice(0, url.indexOf('{{1}}'));
    if (!url.endsWith('{{1}}') || !cartData.checkoutUrl.startsWith(prefix)) {
      throw new Error(`Template "${template.name}" URL button does not match the recovery URL`);
    }
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(urlButtonIndex),
      parameters: [{ type: 'text', text: cartData.checkoutUrl.slice(prefix.length) }],
    });
  }

  const result = await axios.post(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language || 'en_US' },
        components,
      },
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
  );

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: 'SYSTEM',
      senderType: 'SYSTEM',
      direction: 'OUTBOUND',
      text: renderMessage(DEFAULT_TEMPLATES[tier], {
        customer_name: cartData.customerName,
        store_name: settings.storeName,
        product_summary: cartData.productSummary,
        total_amount: cartData.total.toFixed(2),
        currency: cartData.currency,
        checkout_url: cartData.checkoutUrl,
        discount_code: settings.cartDiscountCode,
        discount_label: settings.cartDiscountLabel,
      }),
      type: 'TEXT',
      status: 'sent',
      wamid: result.data?.messages?.[0]?.id,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), updatedAt: new Date() },
  });
  return message;
}

// backend/src/modules/shopify/shopifyCartRecoveryService.js

import axios from 'axios';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import { sendMessageService } from '../messages/messageService.js';
import {
  getOrCreateShopifyContact,
  saveShopifyInboxMessage,
  isProductionEnvironment,
} from './shopifyOrderLifecycle.js';

// ─────────────────────────────────────────────────────────────
// DEFAULT MESSAGE TEMPLATES (Tenant can override via settings)
// ─────────────────────────────────────────────────────────────

const DEFAULT_1H_TEMPLATE = `Hey {{customer_name}}! 👋

You left something in your cart at {{store_name}}:

🛒 {{product_summary}}
💰 Total: {{currency}} {{total_amount}}

Complete your purchase before items sell out:
🔗 {{checkout_url}}`;

const DEFAULT_24H_TEMPLATE = `⏰ *Your cart is about to expire!*

Hi {{customer_name}}, here's what's waiting for you at {{store_name}}:

🛒 {{product_summary}}
💰 Total: {{currency}} {{total_amount}}

Almost sold out — buy now before it's gone:
🔗 {{checkout_url}}`;

const DEFAULT_48H_TEMPLATE = `🎁 *Special offer just for you!*

Hi {{customer_name}}, we noticed you left items at {{store_name}}.

🛒 {{product_summary}}
💰 Total: {{currency}} {{total_amount}}

Use code *{{discount_code}}* for {{discount_label}} off to complete your order!
🏷️ Code: {{discount_code}}

Checkout now:
🔗 {{checkout_url}}`;

// ─────────────────────────────────────────────────────────────
// HELPER: Render message template with variables
// ─────────────────────────────────────────────────────────────

function renderMessage(template, vars) {
  let result = template || '';
  Object.keys(vars).forEach((key) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '');
  });
  return result;
}


// ─────────────────────────────────────────────────────────────
// HELPER: Fetch product image from Shopify Admin API if missing
// ─────────────────────────────────────────────────────────────

async function fetchShopifyProductImage(tenantId, productId, variantId) {
  if (!productId && !variantId) return null;

  try {
    const shopifyConn = await prisma.shopifyConnection.findFirst({
      where: { tenantId },
      select: { shopName: true, accessToken: true },
    });

    if (!shopifyConn || !shopifyConn.accessToken) return null;
    const accessToken = decrypt(shopifyConn.accessToken);

    let cleanShop = shopifyConn.shopName.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase();
    if (!cleanShop.includes('.')) cleanShop = `${cleanShop}.myshopify.com`;

    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';

    // Prefer the selected variant's image when the cart line identifies a variant.
    if (variantId) {
      try {
        const varRes = await axios.get(
          `https://${cleanShop}/admin/api/${apiVersion}/variants/${variantId}.json`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken },
            timeout: 4000,
          }
        );
        const imageProductId = productId || varRes.data?.variant?.product_id;
        if (varRes.data?.variant?.image_id && imageProductId) {
          const imgRes = await axios.get(
            `https://${cleanShop}/admin/api/${apiVersion}/products/${imageProductId}/images/${varRes.data.variant.image_id}.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken },
              timeout: 4000,
            }
          );
          if (imgRes.data?.image?.src) return imgRes.data.image.src;
        }
      } catch (err) {
        console.warn(`⚠️ [Cart Recovery] Could not fetch variant image from Shopify API: ${err.message}`);
      }
    }

    // Fall back to the product's primary image.
    if (productId) {
      const prodRes = await axios.get(
        `https://${cleanShop}/admin/api/${apiVersion}/products/${productId}.json`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken },
          timeout: 4000,
        }
      );
      const imgUrl = prodRes.data?.product?.image?.src || prodRes.data?.product?.images?.[0]?.src;
      if (imgUrl) return imgUrl;
    }
  } catch (err) {
    console.warn(`⚠️ [Cart Recovery] Could not fetch product image from API: ${err.message}`);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Extract checkout data from Shopify payload
// ─────────────────────────────────────────────────────────────
  function extractCheckoutData(payload) {
  const rawPhone =
    payload.phone ||
    payload.customer?.phone ||
    payload.billing_address?.phone ||
    payload.shipping_address?.phone ||
    '';

  let customerPhone = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : '';
  if (customerPhone && !customerPhone.startsWith('+')) customerPhone = `+${customerPhone}`;

  // Extract name from shipping_address first, then billing_address, then customer object
  const shippingName = `${payload.shipping_address?.first_name || ''} ${payload.shipping_address?.last_name || ''}`.trim();
  const billingName = `${payload.billing_address?.first_name || ''} ${payload.billing_address?.last_name || ''}`.trim();
  const customerObjName = `${payload.customer?.first_name || ''} ${payload.customer?.last_name || ''}`.trim();
  const emailName = payload.email ? payload.email.split('@')[0].replace(/[._]/g, ' ') : '';

  const customerName = shippingName || billingName || customerObjName || emailName || 'Customer';

  const lineItems = (payload.line_items || []).map((item) => ({
    name: item.title || item.name || 'Product',
    quantity: item.quantity || 1,
    price: item.price || '0.00',
    imageUrl: item.image || item.image_url || null,
    productId: item.product_id || item.product?.id || null,
    variantId: item.variant_id || item.variant?.id || null,
    sku: item.sku || null,
  }));

    const productSummary = lineItems.map((i) => `${i.name} (x${i.quantity})`).join(', ') || '1 Item';
  const rawImgUrl = lineItems[0]?.imageUrl || null;
  let productImageUrl = rawImgUrl ? String(rawImgUrl).trim().split('?')[0] : null;
  if (productImageUrl && productImageUrl.startsWith('//')) {
    productImageUrl = `https:${productImageUrl}`;
  }

  return {
    checkoutId: String(payload.id || payload.token || ''),
    checkoutToken: payload.token || '',
    customerPhone,
    customerName,
    customerEmail: payload.email || payload.customer?.email || '',
    total: parseFloat(payload.total_price || payload.total || '0.0'),
    currency: payload.currency || 'USD',
    lineItems,
    productSummary,
    productImageUrl,
    checkoutUrl: payload.abandoned_checkout_url || '',
    completedAt: payload.completed_at || null,
    orderId: payload.order_id || null,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPER: Check if checkout already converted to an order
// ─────────────────────────────────────────────────────────────

async function isCheckoutConverted(tenantId, checkoutId, customerPhone) {
  // 1. Check if a real order exists for this checkout
  const existingCartOrder = await prisma.ecommerceOrder.findFirst({
    where: {
      tenantId,
      source: 'SHOPIFY',
      externalOrderId: checkoutId,
    },
    select: { cartStatus: true, status: true },
  });

  if (existingCartOrder && (existingCartOrder.cartStatus === 'converted' || existingCartOrder.cartStatus === 'recovered')) {
    return true;
  }

  // 2. Check if customer placed a different order recently (same phone, status processing/completed)
  if (customerPhone) {
    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    const recentOrder = await prisma.ecommerceOrder.findFirst({
      where: {
        tenantId,
        source: 'SHOPIFY',
        customerPhone: { contains: cleanPhone },
        cartStatus: 'converted',
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // within 7 days
      },
      select: { id: true },
    });
    if (recentOrder) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Build message for each tier
// ─────────────────────────────────────────────────────────────

function buildReminderMessage(tier, cartData, settings) {
  const vars = {
    customer_name: cartData.customerName || 'Customer',
    store_name: settings.storeName || 'our store',
    product_summary: cartData.productSummary || 'items in your cart',
    total_amount: cartData.total?.toFixed(2) || '0.00',
    currency: cartData.currency || 'USD',
    checkout_url: cartData.checkoutUrl || 'your cart link',
    discount_code: settings.cartDiscountCode || 'CART10',
    discount_label: settings.cartDiscountLabel || '10%',
  };

  let template;
  if (tier === '1h') {
    template = settings.cartReminder1Text || DEFAULT_1H_TEMPLATE;
  } else if (tier === '24h') {
    template = settings.cartReminder24Text || DEFAULT_24H_TEMPLATE;
  } else {
    template = settings.cartReminder48Text || DEFAULT_48H_TEMPLATE;
  }

  return renderMessage(template, vars);
}

// ─────────────────────────────────────────────────────────────
// STEP A: Handle checkouts/update webhook → save + schedule
// ─────────────────────────────────────────────────────────────

export async function handleCheckoutUpdate(tenantId, payload) {
  console.log(`🛒 [Cart Recovery] Processing checkout update for tenant ${tenantId}`);

  // 1. Parse checkout data
  const checkout = extractCheckoutData(payload);

    // 1b. If product image URL is missing, auto-fetch from Shopify Admin API
  if (!checkout.productImageUrl && checkout.lineItems?.[0]) {
    const firstItem = checkout.lineItems[0];
    const fetchedImg = await fetchShopifyProductImage(tenantId, firstItem.productId, firstItem.variantId);
      if (fetchedImg) {
      let cleanFetchedImg = String(fetchedImg).trim().split('?')[0];
      if (cleanFetchedImg.startsWith('//')) cleanFetchedImg = `https:${cleanFetchedImg}`;
      checkout.productImageUrl = cleanFetchedImg;
      if (checkout.lineItems[0]) checkout.lineItems[0].imageUrl = cleanFetchedImg;
      console.log(`📸 [Cart Recovery] Auto-fetched product image from Shopify API: ${cleanFetchedImg}`);
    }
  }

  // Fallback placeholder if image API returns 401 or has no image
  if (!checkout.productImageUrl) {
    const fallbackImg = process.env.CART_PLACEHOLDER_IMAGE_URL || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png';
    checkout.productImageUrl = fallbackImg;
    if (checkout.lineItems?.[0] && !checkout.lineItems[0].imageUrl) {
      checkout.lineItems[0].imageUrl = fallbackImg;
    }
    console.log(`📸 [Cart Recovery] Using fallback placeholder product image`);
  }

  if (!checkout.checkoutId) {
    console.warn('⚠️ [Cart Recovery] No checkout ID in payload, skipping');
    return { skipped: true, reason: 'no_checkout_id' };
  }

  // 2. Skip if already completed/converted
  if (checkout.completedAt || checkout.orderId) {
    console.log(`⏭️ [Cart Recovery] Checkout ${checkout.checkoutId} already completed, skipping`);
    return { skipped: true, reason: 'already_completed' };
  }

  // 3. Skip if no phone (can't send WhatsApp)
  if (!checkout.customerPhone) {
    console.warn(`⚠️ [Cart Recovery] Checkout ${checkout.checkoutId} has no phone, skipping`);
    return { skipped: true, reason: 'no_phone' };
  }

  // 4. Load Shopify connection settings
  const shopifyConn = await prisma.shopifyConnection.findFirst({
    where: { tenantId },
    select: {
      shopName: true,
      cartRecoveryEnabled: true,
      cartReminder1Enabled: true,
      cartReminder24Enabled: true,
      cartReminder48Enabled: true,
    },
  });

  if (shopifyConn && shopifyConn.cartRecoveryEnabled === false) {
    console.log(`⏭️ [Cart Recovery] Cart recovery disabled for tenant ${tenantId}`);
    return { skipped: true, reason: 'disabled' };
  }

  // 5. Upsert abandoned cart and refresh any queued reminders with the latest checkout data.
  const orderKey = {
    tenantId_source_externalOrderId: {
      tenantId,
      source: 'SHOPIFY',
      externalOrderId: checkout.checkoutId,
    },
  };

    const cartOrder = await prisma.ecommerceOrder.upsert({
    where: orderKey,
    update: {
      customerName: checkout.customerName,
      customerPhone: checkout.customerPhone,
      customerEmail: checkout.customerEmail,
      total: checkout.total,
      currency: checkout.currency,
      lineItems: checkout.lineItems,
      cartStatus: 'abandoned',
      // Reset sent timestamps so re-testing and cart updates trigger reminders cleanly
      cartReminder1SentAt: null,
      cartReminder24SentAt: null,
      cartReminder48SentAt: null,
    },
    create: {
      tenantId,
      source: 'SHOPIFY',
      externalOrderId: checkout.checkoutId,
      orderNumber: `#${checkout.checkoutId}`,
      status: 'abandoned',
      paymentStatus: 'PENDING',
      total: checkout.total,
      currency: checkout.currency,
      customerName: checkout.customerName,
      customerPhone: checkout.customerPhone,
      customerEmail: checkout.customerEmail,
      shippingAddress: payload.shipping_address || {},
      lineItems: checkout.lineItems,
      cartStatus: 'abandoned',
      cartReminder1SentAt: null,
      cartReminder24SentAt: null,
      cartReminder48SentAt: null,
    },
  });

  console.log(`✅ [Cart Recovery] Abandoned cart saved (ID: ${cartOrder.id}, Checkout: ${checkout.checkoutId})`);

  // 6. Schedule 3 delayed reminders
  await scheduleCartReminders({
    tenantId,
    checkoutId: checkout.checkoutId,
    cartOrderId: cartOrder.id,
    customerPhone: checkout.customerPhone,
    customerName: checkout.customerName,
    customerEmail: checkout.customerEmail,
    total: checkout.total,
    currency: checkout.currency,
    lineItems: checkout.lineItems,
    productSummary: checkout.productSummary,
    productImageUrl: checkout.productImageUrl,
    checkoutUrl: checkout.checkoutUrl,
  });

  return { success: true, cartOrderId: cartOrder.id, checkoutId: checkout.checkoutId };
}

// ─────────────────────────────────────────────────────────────
// STEP B: Schedule 3 delayed BullMQ jobs
// ─────────────────────────────────────────────────────────────

export async function scheduleCartReminders(data) {
  const {
    tenantId,
    checkoutId,
    cartOrderId,
    customerPhone,
    customerName,
    customerEmail,
    total,
    currency,
    lineItems,
    productSummary,
    productImageUrl,
    checkoutUrl,
  } = data;

  const jobData = {
    tenantId,
    checkoutId,
    cartOrderId,
    customerPhone,
    customerName,
    customerEmail,
    total,
    currency,
    lineItems,
    productSummary,
    productImageUrl,
    checkoutUrl,
    source: 'SHOPIFY',
    tier: null, // will be set per job
  };

   // ── Auto-detect: short delays in dev, real delays in prod ──
  const isProd = isProductionEnvironment();
  const DELAYS = isProd
    ? {
        '1h': 60 * 60 * 1000,         // 1 hour
        '24h': 24 * 60 * 60 * 1000,   // 24 hours
        '48h': 48 * 60 * 60 * 1000,   // 48 hours
      }
    : {
        '1h': 10 * 1000,              // 10 seconds (dev test)
        '24h': 30 * 1000,             // 30 seconds (dev test)
        '48h': 60 * 1000,             // 60 seconds (dev test)
      };

  console.log(`⏱️ [Cart Recovery] Using ${isProd ? 'PRODUCTION' : 'DEV'} delays`);

  // Check which reminders are enabled
  const shopifyConn = await prisma.shopifyConnection.findFirst({
    where: { tenantId },
    select: {
      cartReminder1Enabled: true,
      cartReminder24Enabled: true,
      cartReminder48Enabled: true,
    },
  }).catch(() => null);

  const enabled = {
    '1h': shopifyConn?.cartReminder1Enabled !== false,
    '24h': shopifyConn?.cartReminder24Enabled !== false,
    '48h': shopifyConn?.cartReminder48Enabled !== false,
  };

  for (const [tier, delay] of Object.entries(DELAYS)) {
    if (!enabled[tier]) {
      console.log(`⏭️ [Cart Recovery] ${tier} reminder disabled for tenant ${tenantId}, skipping`);
      continue;
    }

        const jobId = `shopify_cart_${tier}_${tenantId}_${checkoutId}`;

    try {
      const existingJob = await orderWebhookQueue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'active') {
          console.log(`⏳ [Cart Recovery] ${tier} job active for ${checkoutId}, leaving active execution`);
          continue;
        }
        // Remove old job (delayed, waiting, completed, or failed) to reschedule freshly
        try {
          await existingJob.remove();
          console.log(`🗑️ [Cart Recovery] Removed existing ${tier} job (state=${state}) for ${checkoutId}`);
        } catch (rmErr) {
          console.warn(`⚠️ [Cart Recovery] Could not remove old job: ${rmErr.message}`);
        }
      }

      await orderWebhookQueue.add(
        `shopify-cart-${tier}`,
        { ...jobData, tier },
        {
          jobId,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: true,
          removeOnFail: { count: 100 },
        }
      );
      console.log(`⏱️ [Cart Recovery] Scheduled ${tier} reminder for checkout ${checkoutId} (delay: ${delay}ms)`);
    } catch (err) {
      console.error(`❌ [Cart Recovery] Failed to schedule ${tier} reminder:`, err.message);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// STEP C: Process a reminder when delayed job fires
// ─────────────────────────────────────────────────────────────

export async function processCartReminder(data) {
  const {
    tenantId,
    checkoutId,
    cartOrderId,
    customerPhone,
    customerName,
    customerEmail,
    total,
    currency,
    lineItems,
    productSummary,
    productImageUrl,
    checkoutUrl,
    tier,
  } = data;

  console.log(`🛒 [Cart Recovery] Processing ${tier} reminder for checkout ${checkoutId} (tenant ${tenantId})`);

  // 1. CRITICAL: Re-check if cart already converted
  const isConverted = await isCheckoutConverted(tenantId, checkoutId, customerPhone);
  if (isConverted) {
    console.log(`✅ [Cart Recovery] Checkout ${checkoutId} already converted, cancelling ${tier} reminder`);

    // Mark cart as converted in DB
    await prisma.ecommerceOrder.updateMany({
      where: { tenantId, source: 'SHOPIFY', externalOrderId: checkoutId },
      data: { cartStatus: 'converted' },
    }).catch(() => {});

    return { skipped: true, reason: 'already_converted', tier };
  }

  // 2. Check if this specific reminder was already sent (dedup)
  const sentFieldMap = {
    '1h': 'cartReminder1SentAt',
    '24h': 'cartReminder24SentAt',
    '48h': 'cartReminder48SentAt',
  };

  const sentField = sentFieldMap[tier];
  if (!sentField) {
    console.warn(`⚠️ [Cart Recovery] Unknown tier: ${tier}`);
    return { skipped: true, reason: 'unknown_tier' };
  }

  const existingCart = await prisma.ecommerceOrder.findFirst({
    where: {
      tenantId,
      source: 'SHOPIFY',
      externalOrderId: checkoutId,
    },
    select: { [sentField]: true, cartStatus: true },
  });

  if (existingCart?.[sentField]) {
    console.log(`⏭️ [Cart Recovery] ${tier} reminder already sent for checkout ${checkoutId}`);
    return { skipped: true, reason: 'already_sent' };
  }

  if (existingCart?.cartStatus === 'converted' || existingCart?.cartStatus === 'recovered') {
    console.log(`⏭️ [Cart Recovery] Cart ${checkoutId} is ${existingCart.cartStatus}, skipping ${tier} reminder`);
    return { skipped: true, reason: 'cart_status_' + existingCart.cartStatus };
  }

  // 3. Load settings
  const shopifyConn = await prisma.shopifyConnection.findFirst({
    where: { tenantId },
    select: {
      shopName: true,
      cartReminder1Text: true,
      cartReminder24Text: true,
      cartReminder48Text: true,
      cartDiscountCode: true,
      cartDiscountLabel: true,
      cartIncludeImage: true,
      cartReminder1Enabled: true,
      cartReminder24Enabled: true,
      cartReminder48Enabled: true,
    },
  }).catch(() => null);

  // Check if this tier is still enabled
  const tierEnabledMap = {
    '1h': 'cartReminder1Enabled',
    '24h': 'cartReminder24Enabled',
    '48h': 'cartReminder48Enabled',
  };
  if (shopifyConn && shopifyConn[tierEnabledMap[tier]] === false) {
    console.log(`⏭️ [Cart Recovery] ${tier} reminder now disabled for tenant ${tenantId}, skipping`);
    return { skipped: true, reason: 'tier_disabled' };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, tenantName: true },
  });

  const settings = {
    storeName: shopifyConn?.shopName || tenant?.tenantName || 'our store',
    cartReminder1Text: shopifyConn?.cartReminder1Text,
    cartReminder24Text: shopifyConn?.cartReminder24Text,
    cartReminder48Text: shopifyConn?.cartReminder48Text,
    cartDiscountCode: shopifyConn?.cartDiscountCode || 'CART10',
    cartDiscountLabel: shopifyConn?.cartDiscountLabel || '10%',
    cartIncludeImage: shopifyConn?.cartIncludeImage !== false,
  };

  // 4. Build message
  const cartData = {
    customerName: customerName || 'Customer',
    total: total || 0,
    currency: currency || 'USD',
    lineItems: lineItems || [],
    productSummary: productSummary || 'items in your cart',
    checkoutUrl: checkoutUrl || 'your cart link',
    productImageUrl: productImageUrl || null,
  };

  const messageBody = buildReminderMessage(tier, cartData, settings);

    // 5. Apply DEV phone override if enabled
  const isProd = isProductionEnvironment();
  let targetPhone = customerPhone;

  if (!isProd && process.env.SHOPIFY_OVERRIDE_PHONE_IN_DEV === 'true') {
    targetPhone = process.env.META_TEST_PHONE || '+15556289708';
    console.log(`📱 [Cart Recovery] DEV phone override active: ${customerPhone} -> ${targetPhone}`);
  }

  const cleanDigits = String(targetPhone || '').replace(/\D/g, '');
  if (!cleanDigits) {
    console.warn(`⚠️ [Cart Recovery] No phone for checkout ${checkoutId}, skipping ${tier} reminder`);
    return { skipped: true, reason: 'no_phone' };
  }

  const cleanPhone = `+${cleanDigits}`;

  const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    customerPhone: cleanPhone,
    customerName: customerName || 'Customer',
    customerEmail: customerEmail || '',
  });

  if (!contact || !conversation) {
    console.warn(`⚠️ [Cart Recovery] Could not find/create contact for checkout ${checkoutId}`);
    return { skipped: true, reason: 'contact_not_found' };
  }

  console.log(`💬 [Cart Recovery] Sending ${tier} reminder to ${cleanPhone}...`);

  // 6. Send message — DEV vs PROD branching
  if (!isProd) {
    // ── DEVELOPMENT: Send free-form text via sendMessageService ──
    // ✅ sendMessageService already saves to inbox, so NO saveShopifyInboxMessage needed
    await sendMessageService({
      tenantId,
      contactId: contact.id,
      senderId: 'SYSTEM',
      senderType: 'SYSTEM',
      text: messageBody,
    });

         // ✅ Send product image as a SEPARATE image message (with cleaned CDN URL)
    if (settings.cartIncludeImage && cartData.productImageUrl) {
      try {
        let cleanMediaUrl = String(cartData.productImageUrl).trim().split('?')[0];
        if (cleanMediaUrl.startsWith('//')) cleanMediaUrl = `https:${cleanMediaUrl}`;

        await sendMessageService({
          tenantId,
          contactId: contact.id,
          senderId: 'SYSTEM',
          senderType: 'SYSTEM',
          type: 'image',
          mediaUrl: cleanMediaUrl,
          fileUrl: cleanMediaUrl,
          caption: `🛒 ${cartData.productSummary}\n💰 ${cartData.currency} ${cartData.total?.toFixed(2)}`,
        });
        console.log(`📸 [Cart Recovery] Product image sent for ${tier} reminder: ${cleanMediaUrl}`);
      } catch (imgErr) {
        console.warn(`⚠️ [Cart Recovery] Image send failed, skipping image: ${imgErr.message}`);
      }
    }

    console.log(`✅ [Cart Recovery] ${tier} reminder sent (DEV mode) to ${cleanPhone}`);
  } else {
    // ── PRODUCTION: Send Meta-approved template ──
    const sentUsingTemplate = await sendProductionCartTemplate({
      tenantId,
      customerPhone: cleanPhone,
      tier,
      cartData,
      settings,
      contact,
      conversation,
    });

    if (sentUsingTemplate) {
      await saveShopifyInboxMessage({
        tenantId,
        conversation,
        contact,
        messageText: messageBody,
        orderRecord: null,
      });
    }
  }

  // 8. Mark reminder as sent in DB
  await prisma.ecommerceOrder.updateMany({
    where: {
      tenantId,
      source: 'SHOPIFY',
      externalOrderId: checkoutId,
    },
    data: {
      [sentField]: new Date(),
    },
  });

  console.log(`✅ [Cart Recovery] ${tier} reminder completed for checkout ${checkoutId}`);

  return { success: true, tier, checkoutId, to: cleanPhone }; 
} 

// ─────────────────────────────────────────────────────────────
// STEP D: Cancel pending reminders when order placed
// ─────────────────────────────────────────────────────────────

export async function cancelCartReminders(tenantId, checkoutId) {
  if (!checkoutId) return;

  const tiers = ['1h', '24h', '48h'];
  let cancelled = 0;

  for (const tier of tiers) {
    const jobId = `shopify_cart_${tier}_${tenantId}_${checkoutId}`;
    try {
      const job = await orderWebhookQueue.getJob(jobId);
      if (job) {
        await job.remove();
        cancelled++;
        console.log(`🗑️ [Cart Recovery] Cancelled ${tier} reminder job for checkout ${checkoutId}`);
      }
    } catch (err) {
      // Job might already be removed/completed/active — that's fine
      if (!err.message?.includes('not found') && !err.message?.includes('locked')) {
        console.warn(`⚠️ [Cart Recovery] Could not cancel ${tier} job ${jobId}: ${err.message}`);
      }
    }
  }

  // Also cancel any cart record matching this checkout (by customer phone, if available)
  // This handles cases where checkout ID differs but customer matches
  try {
    const cancelledJobs = await prisma.ecommerceOrder.updateMany({
      where: {
        tenantId,
        source: 'SHOPIFY',
        externalOrderId: checkoutId,
        cartStatus: 'abandoned',
      },
      data: {
        cartStatus: 'recovered',
      },
    });

    if (cancelledJobs.count > 0) {
      console.log(`✅ [Cart Recovery] Marked ${cancelledJobs.count} cart(s) as 'recovered' for checkout ${checkoutId}`);
    }
  } catch (err) {
    console.warn(`⚠️ [Cart Recovery] Could not update cart status: ${err.message}`);
  }

  console.log(`🗑️ [Cart Recovery] Cancelled ${cancelled} pending reminder job(s) for checkout ${checkoutId}`);
  return { cancelled };
}

// ─────────────────────────────────────────────────────────────
// STEP E: Send Meta template (PRODUCTION ONLY)
// ─────────────────────────────────────────────────────────────

async function sendProductionCartTemplate({
  tenantId,
  customerPhone,
  tier,
  cartData,
  settings,
  contact,
  conversation,
}) {
  try {
    const axios = (await import('axios')).default;
    const { decrypt } = await import('../../lib/crypto.js');

    const tenantConfig = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneId: true,
        whatsappAccessToken: true,
      },
    });

    const phoneNumberId = tenantConfig?.whatsappPhoneId;
    const whatsappToken = tenantConfig?.whatsappAccessToken
      ? decrypt(tenantConfig.whatsappAccessToken)
      : null;

    if (!phoneNumberId || !whatsappToken) {
      console.warn(`⚠️ [Cart Recovery] WhatsApp not connected for tenant ${tenantId}, using text fallback`);
      throw new Error('WhatsApp sender is not connected');
    }

    // Find approved template for this tier
    const templateNameMap = {
      '1h': ['cart_reminder_1h', 'cart_reminder_1hr', 'abandoned_cart_1h', 'cart_1h'],
      '24h': ['cart_reminder_24h', 'cart_reminder_24hr', 'abandoned_cart_24h', 'cart_24h'],
      '48h': ['cart_reminder_48h', 'cart_reminder_48hr', 'abandoned_cart_48h', 'cart_48h', 'cart_discount'],
    };

    const namePatterns = templateNameMap[tier] || [tier];
    const orConditions = namePatterns.map((pattern) => ({ name: { contains: pattern } }));

    let approvedTemplate = null;
    if (settings.cartIncludeImage && cartData.productImageUrl) {
      approvedTemplate = await prisma.template.findFirst({
        where: {
          tenantId,
          status: 'APPROVED',
          headerType: 'IMAGE',
          OR: orConditions,
        },
      }).catch(() => null);
    }
    if (!approvedTemplate) {
      approvedTemplate = await prisma.template.findFirst({
        where: {
          tenantId,
          status: 'APPROVED',
          OR: orConditions,
        },
      }).catch(() => null);
    }

    if (!approvedTemplate) {
      console.warn(`⚠️ [Cart Recovery] No APPROVED template for ${tier} (searched: ${namePatterns.join(', ')}), using text fallback`);
      throw new Error(`No approved WhatsApp template found for ${tier}`);
    }

    // Map numbered template placeholders to the recovery message values.
    const bodyValues = [
      cartData.customerName || 'Customer',
      cartData.productSummary || 'items in your cart',
      cartData.currency || 'USD',
      String(cartData.total?.toFixed(2) || '0.00'),
      cartData.checkoutUrl || 'your cart link',
    ];
    if (tier === '48h') {
      bodyValues.push(settings.cartDiscountCode || 'CART10', settings.cartDiscountLabel || '10%');
    }
    const bodyComponent = Array.isArray(approvedTemplate.components)
      ? approvedTemplate.components.find((component) => component.type?.toUpperCase() === 'BODY')
      : null;
    const placeholderIndices = [...new Set(
      [...(bodyComponent?.text || '').matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]))
    )].sort((a, b) => a - b);
    const bodyParamCount = placeholderIndices.length || approvedTemplate.bodyParams || 0;
    if (
      bodyParamCount > bodyValues.length ||
      placeholderIndices.some((index, position) => index !== position + 1)
    ) {
      throw new Error(`Template "${approvedTemplate.name}" has unsupported body parameters`);
    }
    const bodyParams = placeholderIndices.length
      ? placeholderIndices.map((index) => bodyValues[index - 1] ?? '')
      : bodyValues.slice(0, bodyParamCount);

    // Build components array
    const components = [];

    // Image header (if template has it and tenant enabled images)
    if (settings.cartIncludeImage && cartData.productImageUrl && approvedTemplate.headerType === 'IMAGE') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { link: cartData.productImageUrl },
          },
        ],
      });
    } else if (settings.cartIncludeImage && cartData.productImageUrl) {
      console.warn(`⚠️ [Cart Recovery] Template "${approvedTemplate.name}" has no IMAGE header; sending without product image`);
    }

    // Body parameters
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) })),
      });
    }

    // CTA button (if template has one)
    const templateButtons = Array.isArray(approvedTemplate.buttons) ? approvedTemplate.buttons : [];
    const ctaButtons = templateButtons.filter((button) => button.type?.toUpperCase() !== 'QUICK_REPLY');
    const dynamicUrlIndex = ctaButtons.findIndex(
      (button) => button.type?.toUpperCase() === 'URL' && typeof button.url === 'string' && /\{\{1\}\}/.test(button.url)
    );
    if (dynamicUrlIndex >= 0) {
      const dynamicUrlButton = ctaButtons[dynamicUrlIndex];
      const buttonUrlPrefix = dynamicUrlButton.url.slice(0, dynamicUrlButton.url.indexOf('{{1}}'));
      if (!dynamicUrlButton.url.endsWith('{{1}}') || !cartData.checkoutUrl.startsWith(buttonUrlPrefix)) {
        throw new Error(`Template "${approvedTemplate.name}" URL button does not match the checkout URL`);
      }
      components.push({
        type: 'button',
        sub_type: 'url',
        index: dynamicUrlIndex,
        parameters: [{ type: 'text', text: cartData.checkoutUrl.slice(buttonUrlPrefix.length) }],
      });
    }

    const cleanRecipientPhone = customerPhone.replace(/\D/g, '');

    const templatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipientPhone,
      type: 'template',
      template: {
        name: approvedTemplate.name,
        language: { code: approvedTemplate.language || 'en_US' },
        components,
      },
    };

    const waResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      templatePayload,
      {
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(
      `✅ [Cart Recovery] Template "${approvedTemplate.name}" sent to ${cleanRecipientPhone} (WAMID: ${waResponse.data?.messages?.[0]?.id || 'ok'})`
    );
    return true;
  } catch (err) {
    console.error(`❌ [Cart Recovery] Template send failed for ${tier}:`, err.response?.data || err.message);

    // Last resort fallback: try text message
    try {
      await sendMessageService({
        tenantId,
        contactId: contact.id,
        senderId: 'SYSTEM',
        senderType: 'SYSTEM',
        text: buildReminderMessage(tier, cartData, settings),
      });
      return false;
    } catch (fallbackErr) {
      console.error(`❌ [Cart Recovery] Fallback text also failed:`, fallbackErr.message);
      throw new Error(`WhatsApp template and text fallback both failed for ${tier}`, { cause: fallbackErr });
    }
  }
}
// src/modules/shopify/shopifyPostPurchaseService.js

import prisma from '../../config/prisma.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import { getOrCreateShopifyContact, saveShopifyInboxMessage } from './shopifyOrderLifecycle.js';
import {
  buildReviewRequestMessage,
  buildCrossSellMessage,
  buildUpsellMessage,
  buildReorderReminderMessage,
  buildWinBackMessage,
  parseShopifyReviewRating,
} from './shopifyPostPurchaseMessages.js';

// ─────────────────────────────────────────────
// ENQUEUE: Schedule post-purchase jobs from lifecycle events
// Called by shopifyOrderLifecycle.js when delivery/order events fire
// ─────────────────────────────────────────────

/**
 * Schedule a review request after delivery
 * PURPOSE: Enqueues a delayed BullMQ job that fires after X days
 */
export const scheduleReviewRequest = async ({ tenantId, order, delayDays = 3 }) => {
  if (!order.customerPhone || order.customerPhone === '+') return;
  if (order.reviewRequestedAt) return; // Already scheduled

  const delayMs = delayDays * 24 * 60 * 60 * 1000;

  await orderWebhookQueue.add(
    'shopify-review-request',
    {
      tenantId,
      ecommerceOrderId: order.id,
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      lineItems: order.lineItems,
    },
    { delay: delayMs }
  );

  console.log(`⏱️ [PostPurchase] Review request scheduled for ${order.orderNumber} in ${delayDays} days`);
};

/**
 * Schedule a cross-sell message after delivery
 * PURPOSE: Enqueues a delayed job (1 day after delivery) to recommend related products
 */
export const scheduleCrossSell = async ({ tenantId, order, delayHours = 24 }) => {
  if (!order.customerPhone || order.customerPhone === '+') return;
  if (order.crossSellSentAt) return;

  const delayMs = delayHours * 60 * 60 * 1000;

  await orderWebhookQueue.add(
    'shopify-cross-sell',
    {
      tenantId,
      ecommerceOrderId: order.id,
      orderNumber: order.orderNumber,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      lineItems: order.lineItems,
    },
    { delay: delayMs }
  );

  console.log(`⏱️ [PostPurchase] Cross-sell scheduled for ${order.orderNumber} in ${delayHours}h`);
};

/**
 * Schedule an upsell message after order creation
 * PURPOSE: Enqueues a short-delay job (15 min) to suggest complementary products
 */
export const scheduleUpsell = async ({ tenantId, order }) => {
  if (!order.customerPhone || order.customerPhone === '+') return;
  if (order.upsellSentAt) return;

  const delayMs = 15 * 60 * 1000; // 15 minutes after order

  await orderWebhookQueue.add(
    'shopify-upsell',
    {
      tenantId,
      ecommerceOrderId: order.id,
      orderNumber: order.orderNumber,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      lineItems: order.lineItems,
    },
    { delay: delayMs }
  );

  console.log(`⏱️ [PostPurchase] Upsell scheduled for ${order.orderNumber} in 15 min`);
};

// ─────────────────────────────────────────────
// EXECUTE: Process post-purchase jobs when they fire
// Called by orderWebhookWorker.js when delayed jobs trigger
// ─────────────────────────────────────────────

/**
 * Process review request job
 * PURPOSE: Sends the review/feedback message to customer after delay
 */
export const processReviewRequestJob = async (data) => {
  const { tenantId, ecommerceOrderId, orderNumber, customerPhone, customerName, lineItems } = data;

  // 1. Check if review already submitted or order cancelled
  const order = await prisma.ecommerceOrder.findUnique({
    where: { id: ecommerceOrderId }
  });

  if (!order) return { skipped: true, reason: 'order_not_found' };
  if (order.reviewRating) return { skipped: true, reason: 'review_already_submitted' };
  if (order.status === 'cancelled') return { skipped: true, reason: 'order_cancelled' };

  // 2. Check tenant settings
  const shopifyConfig = await prisma.shopifyConnection.findUnique({
    where: { tenantId }
  });
  if (shopifyConfig && !shopifyConfig.postPurchaseReviewEnabled) {
    return { skipped: true, reason: 'feature_disabled' };
  }

  // 3. Get or create contact + conversation
  const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    customerPhone,
    customerName,
    customerEmail: order.customerEmail || ''
  });

  if (!contact || !conversation) {
    return { skipped: true, reason: 'no_contact' };
  }

  // 4. Build and send message (inbox only in dev mode)
  const messageText = buildReviewRequestMessage({
    customerName,
    orderNumber,
    lineItems,
    storeUrl: ''
  });

  await saveShopifyInboxMessage({
    tenantId,
    conversation,
    contact,
    messageText,
    orderRecord: order
  });

  // 5. Mark review as requested
  await prisma.ecommerceOrder.update({
    where: { id: ecommerceOrderId },
    data: { reviewRequestedAt: new Date() }
  });

  console.log(`✅ [PostPurchase] Review request sent for ${orderNumber} to ${customerPhone}`);
  return { success: true, type: 'REVIEW_REQUEST', orderNumber };
};

/**
 * Process cross-sell job
 * PURPOSE: Finds related products and sends recommendation message
 */
export const processCrossSellJob = async (data) => {
  const { tenantId, ecommerceOrderId, orderNumber, customerPhone, customerName, lineItems } = data;

  const order = await prisma.ecommerceOrder.findUnique({
    where: { id: ecommerceOrderId }
  });

  if (!order) return { skipped: true, reason: 'order_not_found' };
  if (order.crossSellSentAt) return { skipped: true, reason: 'already_sent' };

  const shopifyConfig = await prisma.shopifyConnection.findUnique({
    where: { tenantId }
  });
  if (shopifyConfig && !shopifyConfig.postPurchaseCrossSellEnabled) {
    return { skipped: true, reason: 'feature_disabled' };
  }

  // Find related products from synced Shopify catalog
  // Strategy: same productType or matching tags
  let purchasedProduct = 'your recent purchase';
  let recommendedProducts = [];

  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    if (Array.isArray(items) && items.length > 0) {
      purchasedProduct = items[0].name || items[0].title || 'your recent purchase';
    }

    // Find products with similar tags or productType
    const purchasedProductRecord = await prisma.shopifyProduct.findFirst({
      where: {
        tenantId,
        title: { contains: purchasedProduct.split(' ')[0] } // rough match
      },
      include: { variants: true }
    });

    if (purchasedProductRecord) {
      const relatedProducts = await prisma.shopifyProduct.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          id: { not: purchasedProductRecord.id },
          OR: [
            purchasedProductRecord.productType
              ? { productType: purchasedProductRecord.productType }
              : undefined,
            purchasedProductRecord.vendor
              ? { vendor: purchasedProductRecord.vendor }
              : undefined,
          ].filter(Boolean)
        },
        include: { variants: true, images: true },
        take: 3
      });

      recommendedProducts = relatedProducts.map(p => ({
        title: p.title,
        price: p.variants?.[0]?.price || 0,
        currency: p.variants?.[0]?.currency || 'INR',
        productUrl: p.productUrl
      }));
    }
  } catch (err) {
    console.warn(`⚠️ [PostPurchase] Cross-sell product lookup failed:`, err.message);
  }

  if (recommendedProducts.length === 0) {
    console.log(`⏭️ [PostPurchase] No related products found for cross-sell on ${orderNumber}`);
    return { skipped: true, reason: 'no_related_products' };
  }

  const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId, customerPhone, customerName, customerEmail: order.customerEmail || ''
  });

  if (!contact || !conversation) return { skipped: true, reason: 'no_contact' };

  const messageText = buildCrossSellMessage({
    customerName,
    purchasedProduct,
    recommendedProducts,
    storeUrl: ''
  });

  await saveShopifyInboxMessage({
    tenantId, conversation, contact, messageText, orderRecord: order
  });

  await prisma.ecommerceOrder.update({
    where: { id: ecommerceOrderId },
    data: { crossSellSentAt: new Date() }
  });

  console.log(`✅ [PostPurchase] Cross-sell sent for ${orderNumber}`);
  return { success: true, type: 'CROSS_SELL', orderNumber };
};

/**
 * Process upsell job
 * PURPOSE: Suggests complementary product before order ships
 */
export const processUpsellJob = async (data) => {
  const { tenantId, ecommerceOrderId, orderNumber, customerPhone, customerName, lineItems } = data;

  const order = await prisma.ecommerceOrder.findUnique({
    where: { id: ecommerceOrderId }
  });

  if (!order) return { skipped: true, reason: 'order_not_found' };
  if (order.upsellSentAt) return { skipped: true, reason: 'already_sent' };
  // Don't upsell if already shipped
  if (['completed', 'delivered', 'shipped'].includes(order.status?.toLowerCase())) {
    return { skipped: true, reason: 'order_already_shipped' };
  }

  const shopifyConfig = await prisma.shopifyConnection.findUnique({
    where: { tenantId }
  });
  if (shopifyConfig && !shopifyConfig.postPurchaseUpsellEnabled) {
    return { skipped: true, reason: 'feature_disabled' };
  }

  // Find a complementary product (simplified: different product, same vendor)
  let upsellProduct = null;
  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    const firstItemName = Array.isArray(items) && items.length > 0
      ? (items[0].name || items[0].title || '')
      : '';

    const purchasedRecord = await prisma.shopifyProduct.findFirst({
      where: { tenantId, title: { contains: firstItemName.split(' ')[0] } }
    });

    if (purchasedRecord?.vendor) {
      const complementary = await prisma.shopifyProduct.findFirst({
        where: {
          tenantId,
          vendor: purchasedRecord.vendor,
          id: { not: purchasedRecord.id },
          status: 'ACTIVE'
        },
        include: { variants: true }
      });

      if (complementary) {
        upsellProduct = {
          title: complementary.title,
          price: complementary.variants?.[0]?.price || 0,
          currency: complementary.variants?.[0]?.currency || 'INR',
          productUrl: complementary.productUrl
        };
      }
    }
  } catch (err) {
    console.warn(`⚠️ [PostPurchase] Upsell product lookup failed:`, err.message);
  }

  if (!upsellProduct) {
    return { skipped: true, reason: 'no_upsell_product' };
  }

  const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId, customerPhone, customerName, customerEmail: order.customerEmail || ''
  });

  if (!contact || !conversation) return { skipped: true, reason: 'no_contact' };

  const messageText = buildUpsellMessage({
    customerName, orderNumber, upsellProduct, storeUrl: ''
  });

  await saveShopifyInboxMessage({
    tenantId, conversation, contact, messageText, orderRecord: order
  });

  await prisma.ecommerceOrder.update({
    where: { id: ecommerceOrderId },
    data: { upsellSentAt: new Date() }
  });

  console.log(`✅ [PostPurchase] Upsell sent for ${orderNumber}`);
  return { success: true, type: 'UPSELL', orderNumber };
};

/**
 * Handle incoming review rating reply from customer
 * PURPOSE: When customer replies "4" or "5 stars" after a review request,
 *   parse the rating and save it to the EcommerceOrder record.
 *   This is the missing piece in your WooCommerce implementation too.
 */
export const handleReviewReply = async ({ tenantId, contactPhone, userMessage }) => {
  const rating = parseShopifyReviewRating(userMessage);
  if (!rating) return null; // Not a valid rating reply

  // Find the most recent order that has a pending review
  const pendingReviewOrder = await prisma.ecommerceOrder.findFirst({
    where: {
      tenantId,
      customerPhone: contactPhone,
      source: 'SHOPIFY',
      reviewRequestedAt: { not: null },
      reviewRating: null, // Not yet rated
    },
    orderBy: { reviewRequestedAt: 'desc' }
  });

  if (!pendingReviewOrder) return null; // No pending review for this customer

  await prisma.ecommerceOrder.update({
    where: { id: pendingReviewOrder.id },
    data: {
      reviewRating: rating,
      reviewReceivedAt: new Date()
    }
  });

 console.log(`⭐ [PostPurchase] Review saved: ${rating}/5 for order ${pendingReviewOrder.orderNumber}`);
  return { success: true, rating, orderNumber: pendingReviewOrder.orderNumber };
};

/**
 * Process reorder reminder job
 * PURPOSE: Sends reorder message for consumable products delivered N days ago
 */
export const processReorderReminderJob = async (data) => {
  const { tenantId, ecommerceOrderId, orderNumber, customerPhone, customerName, lineItems } = data;

  const order = await prisma.ecommerceOrder.findUnique({
    where: { id: ecommerceOrderId }
  });

  if (!order || order.reorderReminderSentAt) {
    return { skipped: true, reason: 'already_sent_or_not_found' };
  }

  const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId, customerPhone, customerName, customerEmail: order.customerEmail || ''
  });

  if (!contact || !conversation) return { skipped: true, reason: 'no_contact' };

  // Extract first product name for the message
  let productName = 'your favorite product';
  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    if (Array.isArray(items) && items.length > 0) {
      productName = items[0].name || items[0].title || productName;
    }
  } catch {}

  const messageText = buildReorderReminderMessage({
    customerName: customerName || 'Customer',
    productName,
    productUrl: '',
    storeUrl: ''
  });

  await saveShopifyInboxMessage({
    tenantId, conversation, contact, messageText, orderRecord: order
  });

  await prisma.ecommerceOrder.update({
    where: { id: ecommerceOrderId },
    data: { reorderReminderSentAt: new Date() }
  });

  console.log(`✅ [PostPurchase] Reorder reminder sent for ${orderNumber}`);
  return { success: true, type: 'REORDER_REMINDER', orderNumber };
};

/**
 * Process win-back job
 * PURPOSE: Sends win-back message to customers inactive for 90+ days
 */
export const processWinBackJob = async (data) => {
  const { tenantId, ecommerceOrderId, customerPhone, customerName } = data;

  const order = await prisma.ecommerceOrder.findUnique({
    where: { id: ecommerceOrderId }
  });

  if (!order) return { skipped: true, reason: 'order_not_found' };

  // Check if customer has ordered recently (safety check)
  const recentOrder = await prisma.ecommerceOrder.findFirst({
    where: {
      tenantId,
      source: 'SHOPIFY',
      customerPhone,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }
  });

  if (recentOrder) return { skipped: true, reason: 'customer_recently_active' };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true }
  });

  const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId, customerPhone, customerName, customerEmail: order.customerEmail || ''
  });

  if (!contact || !conversation) return { skipped: true, reason: 'no_contact' };

  const messageText = buildWinBackMessage({
    customerName: customerName || 'Customer',
    storeName: tenant?.tenantName || 'our store',
    storeUrl: '',
    discountCode: ''
  });

  await saveShopifyInboxMessage({
    tenantId, conversation, contact, messageText, orderRecord: order
  });

  await prisma.ecommerceOrder.update({
    where: { id: ecommerceOrderId },
    data: { winBackSentAt: new Date() }
  });

  console.log(`✅ [PostPurchase] Win-back sent to ${customerPhone}`);
  return { success: true, type: 'WIN_BACK', customerPhone };
};
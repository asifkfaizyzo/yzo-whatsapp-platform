// backend/src/modules/shopify/orders/shopify.postPurchase.service.js (do not remove this comment)

import prisma from "../../../config/prisma.js";
import { orderWebhookQueue } from "../../../cron/queues/order-webhook.queue.js";
import {
  getOrCreateShopifyContact,
  saveShopifyInboxMessage,
} from "./shopify.orderLifecycle.js";
import {
  buildReviewRequestMessage,
  buildCrossSellMessage,
  buildUpsellMessage,
  buildReorderReminderMessage,
  buildWinBackMessage,
  parseShopifyReviewRating,
} from "./shopify.postPurchaseMessages.js";

const isShopifyCustomerRedacted = async (storeId, shopifyCustomerId) => {
  if (shopifyCustomerId == null) return false;

  const redaction = await prisma.shopifyCustomerRedaction.findUnique({
    where: {
      storeId_shopifyCustomerId: {
        storeId,
        shopifyCustomerId: String(shopifyCustomerId),
      },
    },
    select: { id: true },
  });

  return Boolean(redaction);
};

const checkPostPurchaseRedaction = async ({
  tenantId,
  storeId,
  shopifyCustomerId,
}) => {
  try {
    const store = await prisma.shopifyStore.findFirst({
      where: { id: storeId, tenantId, status: "active", redactedAt: null },
      select: { id: true, tenantId: true, status: true, redactedAt: true },
    });
    if (
      !store || store.id !== storeId || store.tenantId !== tenantId ||
      store.status !== "active" || store.redactedAt !== null
    ) {
      return { skipped: true, reason: "inactive_or_invalid_store" };
    }

    if (shopifyCustomerId != null &&
      await isShopifyCustomerRedacted(storeId, shopifyCustomerId)) {
      return { skipped: true, reason: "customer_redacted" };
    }
    return null;
  } catch {
    return { skipped: true, reason: "shopify_redaction_check_failed" };
  }
};

// ─────────────────────────────────────────────
// ENQUEUE: Schedule post-purchase jobs from lifecycle events
// Called by shopify.orderLifecycle.js when delivery/order events fire
// ─────────────────────────────────────────────

/**
 * Schedule a review request after delivery
 * PURPOSE: Enqueues a delayed BullMQ job that fires after X days
 */
export const scheduleReviewRequest = async ({
  tenantId,
  order,
  delayDays = 3,
}) => {
  if (!order.customerPhone || order.customerPhone === "+") return;
  if (order.reviewRequestedAt) return; // Already scheduled

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId: order.shopifyStoreId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;

  const delayMs = delayDays * 24 * 60 * 60 * 1000;

  await orderWebhookQueue.add(
    "shopify-review-request",
    {
      tenantId,
      storeId: order.shopifyStoreId,
      ecommerceOrderId: order.id,
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      lineItems: order.lineItems,
    },
    { delay: delayMs },
  );

  console.log(
    `⏱️ [PostPurchase] Review request scheduled for ${order.orderNumber} in ${delayDays} days`,
  );
};

/**
 * Schedule a cross-sell message after delivery
 * PURPOSE: Enqueues a delayed job (1 day after delivery) to recommend related products
 */
export const scheduleCrossSell = async ({
  tenantId,
  order,
  delayHours = 24,
}) => {
  if (!order.customerPhone || order.customerPhone === "+") return;
  if (order.crossSellSentAt) return;

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId: order.shopifyStoreId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;

  const delayMs = delayHours * 60 * 60 * 1000;

  await orderWebhookQueue.add(
    "shopify-cross-sell",
    {
       tenantId,
      storeId: order.shopifyStoreId,
      ecommerceOrderId: order.id,
      orderNumber: order.orderNumber,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      lineItems: order.lineItems,
    },
    { delay: delayMs },
  );

  console.log(
    `⏱️ [PostPurchase] Cross-sell scheduled for ${order.orderNumber} in ${delayHours}h`,
  );
};

/**
 * Schedule an upsell message after order creation
 * PURPOSE: Enqueues a short-delay job (15 min) to suggest complementary products
 */
export const scheduleUpsell = async ({ tenantId, order }) => {
  if (!order.customerPhone || order.customerPhone === "+") return;
  if (order.upsellSentAt) return;

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId: order.shopifyStoreId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;

  const delayMs = 15 * 60 * 1000; // 15 minutes after order

  await orderWebhookQueue.add(
    "shopify-upsell",
        {
      tenantId,
      storeId: order.shopifyStoreId,
      ecommerceOrderId: order.id,
      orderNumber: order.orderNumber,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      lineItems: order.lineItems,
    },
    { delay: delayMs },
  );

  console.log(
    `⏱️ [PostPurchase] Upsell scheduled for ${order.orderNumber} in 15 min`,
  );
};

// ─────────────────────────────────────────────
// EXECUTE: Process post-purchase jobs when they fire
// Called by order-webhook.worker.js when delayed jobs trigger
// ─────────────────────────────────────────────

/**
 * Process review request job
 * PURPOSE: Sends the review/feedback message to customer after delay
 */
export const processReviewRequestJob = async (data) => {
  const {
    tenantId,
    storeId,
    ecommerceOrderId,
    orderNumber,
    customerPhone,
    customerName,
    lineItems,
  } = data;

  // 1. Check if review already submitted or order cancelled
  const order = await prisma.ecommerceOrder.findFirst({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
  });

  if (!order) return { skipped: true, reason: "order_not_found" };
  if (
    await isShopifyCustomerRedacted(
      order.shopifyStoreId,
      order.shopifyCustomerId,
    )
  ) {
    return { skipped: true, reason: "customer_redacted" };
  }
    const activeStore = await prisma.shopifyStore.findFirst({
    where: {
      id: storeId,
      tenantId,
      status: "active",
      redactedAt: null,
    },
    select: { id: true },
  });

  if (!activeStore) {
    return { skipped: true, reason: "invalid_shopify_store" };
  }
  if (order.reviewRating)
    return { skipped: true, reason: "review_already_submitted" };
  if (order.status === "cancelled")
    return { skipped: true, reason: "order_cancelled" };

  // 2. Check tenant settings
  const shopifyConfig = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });
  if (shopifyConfig && !shopifyConfig.postPurchaseReviewEnabled) {
    return { skipped: true, reason: "feature_disabled" };
  }

  // 3. Get or create contact + conversation
    const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerEmail: order.customerEmail || "",
  });

  if (!contact || !conversation) {
    return { skipped: true, reason: "no_contact" };
  }

  // 4. Build and send message (inbox only in dev mode)
    const messageText = buildReviewRequestMessage({
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    lineItems: order.lineItems,
    storeUrl: "",
  });

  // 5. Mark review as requested
  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;
    const reviewUpdate = await prisma.ecommerceOrder.updateMany({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
    data: { reviewRequestedAt: new Date() },
  });

  if (reviewUpdate.count === 0) {
    return { skipped: true, reason: "order_store_ownership_mismatch" };
  }

  const inboxResult = await saveShopifyInboxMessage({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    conversation,
    contact,
    messageText,
    orderRecord: order,
  });
  if (inboxResult?.skipped) return inboxResult;

  console.log(
    `✅ [PostPurchase] Review request sent for ${orderNumber} to ${customerPhone}`,
  );
  return { success: true, type: "REVIEW_REQUEST", orderNumber };
};

/**
 * Process cross-sell job
 * PURPOSE: Finds related products and sends recommendation message
 */
export const processCrossSellJob = async (data) => {
  const {
    tenantId,
    storeId,
    ecommerceOrderId,
    orderNumber,
    customerPhone,
    customerName,
    lineItems,
  } = data;

    const order = await prisma.ecommerceOrder.findFirst({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
  });

  if (!order) return { skipped: true, reason: "order_not_found" };
  if (
    await isShopifyCustomerRedacted(
      order.shopifyStoreId,
      order.shopifyCustomerId,
    )
  ) {
    return { skipped: true, reason: "customer_redacted" };
  }
    const activeStore = await prisma.shopifyStore.findFirst({
    where: {
      id: storeId,
      tenantId,
      status: "active",
      redactedAt: null,
    },
    select: { id: true },
  });

  if (!activeStore) {
    return { skipped: true, reason: "invalid_shopify_store" };
  }
  if (order.crossSellSentAt) return { skipped: true, reason: "already_sent" };

  const shopifyConfig = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });
  if (shopifyConfig && !shopifyConfig.postPurchaseCrossSellEnabled) {
    return { skipped: true, reason: "feature_disabled" };
  }

  // Find related products from synced Shopify catalog
  // Strategy: same productType or matching tags
  let purchasedProduct = "your recent purchase";
  let recommendedProducts = [];

  try {
    const items =
      typeof lineItems === "string" ? JSON.parse(lineItems) : lineItems;
    if (Array.isArray(items) && items.length > 0) {
      purchasedProduct =
        items[0].name || items[0].title || "your recent purchase";
    }

    // Find products with similar tags or productType
    const purchasedProductRecord = await prisma.shopifyProduct.findFirst({
      where: {
        tenantId,
        title: { contains: purchasedProduct.split(" ")[0] }, // rough match
      },
      include: { variants: true },
    });

    if (purchasedProductRecord) {
      const relatedProducts = await prisma.shopifyProduct.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          id: { not: purchasedProductRecord.id },
          OR: [
            purchasedProductRecord.productType
              ? { productType: purchasedProductRecord.productType }
              : undefined,
            purchasedProductRecord.vendor
              ? { vendor: purchasedProductRecord.vendor }
              : undefined,
          ].filter(Boolean),
        },
        include: { variants: true, images: true },
        take: 3,
      });

      recommendedProducts = relatedProducts.map((p) => ({
        title: p.title,
        price: p.variants?.[0]?.price || 0,
        currency: p.variants?.[0]?.currency || "INR",
        productUrl: p.productUrl,
      }));
    }
  } catch (err) {
    console.warn(
      `⚠️ [PostPurchase] Cross-sell product lookup failed:`,
      err.message,
    );
  }

  if (recommendedProducts.length === 0) {
    console.log(
      `⏭️ [PostPurchase] No related products found for cross-sell on ${orderNumber}`,
    );
    return { skipped: true, reason: "no_related_products" };
  }

    const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerEmail: order.customerEmail || "",
  });

  if (!contact || !conversation) return { skipped: true, reason: "no_contact" };

    const messageText = buildCrossSellMessage({
    customerName: order.customerName,
    purchasedProduct,
    recommendedProducts,
    storeUrl: "",
  });

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;
    const crossSellUpdate = await prisma.ecommerceOrder.updateMany({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
    data: { crossSellSentAt: new Date() },
  });

  if (crossSellUpdate.count === 0) {
    return { skipped: true, reason: "order_store_ownership_mismatch" };
  }

  const inboxResult = await saveShopifyInboxMessage({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    conversation,
    contact,
    messageText,
    orderRecord: order,
  });
  if (inboxResult?.skipped) return inboxResult;

  console.log(`✅ [PostPurchase] Cross-sell sent for ${orderNumber}`);
  return { success: true, type: "CROSS_SELL", orderNumber };
};

/**
 * Process upsell job
 * PURPOSE: Suggests complementary product before order ships
 */
export const processUpsellJob = async (data) => {
  const {
    tenantId,
    ecommerceOrderId,
    orderNumber,
    customerPhone,
    customerName,
    lineItems,
    storeId,
  } = data;

    const order = await prisma.ecommerceOrder.findFirst({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
  });

  if (!order) return { skipped: true, reason: "order_not_found" };
  if (
    await isShopifyCustomerRedacted(
      order.shopifyStoreId,
      order.shopifyCustomerId,
    )
  ) {
    return { skipped: true, reason: "customer_redacted" };
  }
    const activeStore = await prisma.shopifyStore.findFirst({
    where: {
      id: storeId,
      tenantId,
      status: "active",
      redactedAt: null,
    },
    select: { id: true },
  });

  if (!activeStore) {
    return { skipped: true, reason: "invalid_shopify_store" };
  }
  if (order.upsellSentAt) return { skipped: true, reason: "already_sent" };
  // Don't upsell if already shipped
  if (
    ["completed", "delivered", "shipped"].includes(order.status?.toLowerCase())
  ) {
    return { skipped: true, reason: "order_already_shipped" };
  }

  const shopifyConfig = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });
  if (shopifyConfig && !shopifyConfig.postPurchaseUpsellEnabled) {
    return { skipped: true, reason: "feature_disabled" };
  }

  // Find a complementary product (simplified: different product, same vendor)
  let upsellProduct = null;
  try {
    const items =
      typeof lineItems === "string" ? JSON.parse(lineItems) : lineItems;
    const firstItemName =
      Array.isArray(items) && items.length > 0
        ? items[0].name || items[0].title || ""
        : "";

    const purchasedRecord = await prisma.shopifyProduct.findFirst({
      where: { tenantId, title: { contains: firstItemName.split(" ")[0] } },
    });

    if (purchasedRecord?.vendor) {
      const complementary = await prisma.shopifyProduct.findFirst({
        where: {
          tenantId,
          vendor: purchasedRecord.vendor,
          id: { not: purchasedRecord.id },
          status: "ACTIVE",
        },
        include: { variants: true },
      });

      if (complementary) {
        upsellProduct = {
          title: complementary.title,
          price: complementary.variants?.[0]?.price || 0,
          currency: complementary.variants?.[0]?.currency || "INR",
          productUrl: complementary.productUrl,
        };
      }
    }
  } catch (err) {
    console.warn(
      `⚠️ [PostPurchase] Upsell product lookup failed:`,
      err.message,
    );
  }

  if (!upsellProduct) {
    return { skipped: true, reason: "no_upsell_product" };
  }

   const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerEmail: order.customerEmail || "",
  });

  if (!contact || !conversation) return { skipped: true, reason: "no_contact" };

  const messageText = buildUpsellMessage({
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    upsellProduct,
    storeUrl: "",
  });

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;
    const upsellUpdate = await prisma.ecommerceOrder.updateMany({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
    data: { upsellSentAt: new Date() },
  });

  if (upsellUpdate.count === 0) {
    return { skipped: true, reason: "order_store_ownership_mismatch" };
  }

  const inboxResult = await saveShopifyInboxMessage({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    conversation,
    contact,
    messageText,
    orderRecord: order,
  });
  if (inboxResult?.skipped) return inboxResult;

  console.log(`✅ [PostPurchase] Upsell sent for ${orderNumber}`);
  return { success: true, type: "UPSELL", orderNumber };
};


/**
 * Handle incoming review rating reply from customer.
 * Temporarily disabled until trusted Shopify store identity
 * is available in the incoming conversation context.
 */
export const handleReviewReply = async ({
  tenantId,
  contactPhone,
  userMessage,
  storeId,
}) => {
  // Do not process ratings without trusted store identity.
  if (!storeId) {
    return { handled: false };
  }

  const rating = parseShopifyReviewRating(userMessage);
  if (!rating) {
    return { handled: false };
  }

  // Validate that the store belongs to this tenant and is active.
  const store = await prisma.shopifyStore.findFirst({
    where: {
      id: storeId,
      tenantId,
      status: "active",
      redactedAt: null,
    },
    select: { id: true },
  });

  if (!store) {
    return { handled: false };
  }

  // Find a pending review belonging to this exact store.
  const pendingReviewOrder = await prisma.ecommerceOrder.findFirst({
    where: {
      tenantId,
      shopifyStoreId: store.id,
      customerPhone: contactPhone,
      source: "SHOPIFY",
      reviewRequestedAt: { not: null },
      reviewRating: null,
    },
    orderBy: { reviewRequestedAt: "desc" },
  });

  if (!pendingReviewOrder) {
    return { handled: false };
  }

  // Update only if the order still belongs to this store
  // and the review is still pending.
  const updateResult = await prisma.ecommerceOrder.updateMany({
    where: {
      id: pendingReviewOrder.id,
      tenantId,
      shopifyStoreId: store.id,
      source: "SHOPIFY",
      reviewRequestedAt: { not: null },
      reviewRating: null,
    },
    data: {
      reviewRating: rating,
      reviewReceivedAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    return { handled: false };
  }

  console.log(
    `⭐ [PostPurchase] Review saved: ${rating}/5 for order ${pendingReviewOrder.orderNumber}`,
  );

  return {
    handled: true,
    orderId: pendingReviewOrder.id,
    responseSent: false,
    rating,
    orderNumber: pendingReviewOrder.orderNumber,
  };
};


/**
 * Process reorder reminder job
 * PURPOSE: Sends reorder message for consumable products delivered N days ago
 */
export const processReorderReminderJob = async (data) => {
  const {
    tenantId,
    storeId,
    ecommerceOrderId,
    orderNumber,
    customerPhone,
    customerName,
    lineItems,
  } = data;

    const order = await prisma.ecommerceOrder.findFirst({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
  });

    if (!order) {
    return { skipped: true, reason: "already_sent_or_not_found" };
  }

  if (
    await isShopifyCustomerRedacted(
      order.shopifyStoreId,
      order.shopifyCustomerId,
    )
  ) {
    return { skipped: true, reason: "customer_redacted" };
  }

  if (order.reorderReminderSentAt) {
    return { skipped: true, reason: "already_sent_or_not_found" };
  }

  const activeStore = await prisma.shopifyStore.findFirst({
    where: {
      id: storeId,
      tenantId,
      status: "active",
      redactedAt: null,
    },
    select: { id: true },
  });

  if (!activeStore) {
    return { skipped: true, reason: "inactive_or_invalid_store" };
  }

    const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerEmail: order.customerEmail || "",
  });

  if (!contact || !conversation) return { skipped: true, reason: "no_contact" };

  // Extract first product name for the message
  let productName = "your favorite product";
  try {
    const items =
      typeof lineItems === "string" ? JSON.parse(lineItems) : lineItems;
    if (Array.isArray(items) && items.length > 0) {
      productName = items[0].name || items[0].title || productName;
    }
  } catch {}

    const messageText = buildReorderReminderMessage({
    customerName: order.customerName || "Customer",
    productName,
    productUrl: "",
    storeUrl: "",
  });

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;
    const updateResult = await prisma.ecommerceOrder.updateMany({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
    data: { reorderReminderSentAt: new Date() },
  });

  if (updateResult.count === 0) {
    return { skipped: true, reason: "order_store_ownership_mismatch" };
  }

  const inboxResult = await saveShopifyInboxMessage({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    conversation,
    contact,
    messageText,
    orderRecord: order,
  });
  if (inboxResult?.skipped) return inboxResult;

  console.log(`✅ [PostPurchase] Reorder reminder sent for ${order.orderNumber}`);
  return {
    success: true,
    type: "REORDER_REMINDER",
    orderNumber: order.orderNumber,
  };
};

/**
 * Process win-back job
 * PURPOSE: Sends win-back message to customers inactive for 90+ days
 */
export const processWinBackJob = async (data) => {
  const { tenantId, storeId, ecommerceOrderId, customerPhone, customerName } = data;

    const order = await prisma.ecommerceOrder.findFirst({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
  });

    if (!order) return { skipped: true, reason: "order_not_found" };

  if (
    await isShopifyCustomerRedacted(
      order.shopifyStoreId,
      order.shopifyCustomerId,
    )
  ) {
    return { skipped: true, reason: "customer_redacted" };
  }

  const activeStore = await prisma.shopifyStore.findFirst({
    where: {
      id: storeId,
      tenantId,
      status: "active",
      redactedAt: null,
    },
    select: { id: true },
  });

  if (!activeStore) {
    return { skipped: true, reason: "inactive_or_invalid_store" };
  }

  // Check if customer has ordered recently (safety check)
  const recentOrder = await prisma.ecommerceOrder.findFirst({
       where: {
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
      customerPhone: order.customerPhone,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  if (recentOrder) return { skipped: true, reason: "customer_recently_active" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true },
  });

    const { contact, conversation } = await getOrCreateShopifyContact({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerEmail: order.customerEmail || "",
  });

  if (!contact || !conversation) return { skipped: true, reason: "no_contact" };

  const messageText = buildWinBackMessage({
    customerName: order.customerName || "Customer",
    storeName: tenant?.tenantName || "our store",
    storeUrl: "",
    discountCode: "",
  });

  const redactionGuard = await checkPostPurchaseRedaction({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
  });
  if (redactionGuard) return redactionGuard;
    const updateResult = await prisma.ecommerceOrder.updateMany({
    where: {
      id: ecommerceOrderId,
      tenantId,
      source: "SHOPIFY",
      shopifyStoreId: storeId,
    },
    data: { winBackSentAt: new Date() },
  });

  if (updateResult.count === 0) {
    return { skipped: true, reason: "order_store_ownership_mismatch" };
  }

  const inboxResult = await saveShopifyInboxMessage({
    tenantId,
    storeId,
    shopifyCustomerId: order.shopifyCustomerId,
    conversation,
    contact,
    messageText,
    orderRecord: order,
  });
  if (inboxResult?.skipped) return inboxResult;

  console.log(`✅ [PostPurchase] Win-back sent to ${customerPhone}`);
  return { success: true, type: "WIN_BACK", customerPhone };
};

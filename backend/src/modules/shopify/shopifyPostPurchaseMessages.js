// src/modules/shopify/shopifyPostPurchaseMessages.js

/**
 * Format currency amount for display
 */
const formatAmount = (currency, total) => {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency || '';
  return `${symbol}${Number(total || 0).toFixed(2)}`;
};

/**
 * Extract product names from lineItems (stored as JSON in EcommerceOrder)
 */
const extractProductNames = (lineItems) => {
  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    if (!Array.isArray(items)) return 'your product';
    return items.map(i => i.name || i.title || 'Product').join(', ');
  } catch {
    return 'your product';
  }
};

/**
 * Extract first product name (for singular messages like review)
 */
const extractFirstProduct = (lineItems) => {
  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    if (!Array.isArray(items) || items.length === 0) return 'your product';
    return items[0].name || items[0].title || 'Product';
  } catch {
    return 'your product';
  }
};

// ─────────────────────────────────────────────
// 8.1 REVIEW / FEEDBACK REQUEST
// ─────────────────────────────────────────────
export const buildReviewRequestMessage = ({ customerName, orderNumber, lineItems, storeUrl }) => {
  const product = extractFirstProduct(lineItems);
  return (
    `⭐ *How was your experience?*\n\n` +
    `Hi *${customerName}*, your order *${orderNumber}* was delivered recently.\n\n` +
    `We'd love to hear about your *${product}*!\n\n` +
    `Please rate your experience (1-5):\n` +
    `1️⃣ Poor\n2️⃣ Fair\n3️⃣ Good\n4️⃣ Very Good\n5️⃣ Excellent\n\n` +
    `Just reply with a number! 😊`
  );
};

// ─────────────────────────────────────────────
// 8.2 CROSS-SELL (After delivery)
// ─────────────────────────────────────────────
export const buildCrossSellMessage = ({ customerName, purchasedProduct, recommendedProducts, storeUrl }) => {
  const recommendations = (recommendedProducts || [])
    .slice(0, 3)
    .map((p, i) => `${i + 1}. *${p.title}* — ${formatAmount(p.currency, p.price)}\n   ${p.productUrl || ''}`)
    .join('\n\n');

  return (
    `🛍️ *You might also love...*\n\n` +
    `Hi *${customerName}*, customers who bought *${purchasedProduct}* also loved these:\n\n` +
    `${recommendations}\n\n` +
    `Tap any link to shop! 🛒`
  );
};

// ─────────────────────────────────────────────
// 8.3 UPSELL (After order confirmed, before shipping)
// ─────────────────────────────────────────────
export const buildUpsellMessage = ({ customerName, orderNumber, upsellProduct, storeUrl }) => {
  return (
    `✨ *Perfect match for your order!*\n\n` +
    `Hi *${customerName}*, you just ordered *${orderNumber}*.\n\n` +
    `Add *${upsellProduct.title}* for just ${formatAmount(upsellProduct.currency, upsellProduct.price)}!\n\n` +
    `👉 ${upsellProduct.productUrl || storeUrl || 'Visit our store'}\n\n` +
    `_Hurry, your order hasn't shipped yet!_`
  );
};

// ─────────────────────────────────────────────
// 8.4 REORDER REMINDER (30 days after consumable)
// ─────────────────────────────────────────────
export const buildReorderReminderMessage = ({ customerName, productName, productUrl, storeUrl }) => {
  return (
    `🔄 *Time to restock?*\n\n` +
    `Hi *${customerName}*, it's been a while since you ordered *${productName}*.\n\n` +
    `Running low? Reorder now before it goes out of stock!\n\n` +
    `👉 ${productUrl || storeUrl || 'Visit our store'}`
  );
};

// ─────────────────────────────────────────────
// 8.6 WIN-BACK CAMPAIGN (90 days inactive)
// ─────────────────────────────────────────────
export const buildWinBackMessage = ({ customerName, storeName, storeUrl, discountCode }) => {
  const discountLine = discountCode
    ? `\n\n🎁 Use code *${discountCode}* for a special discount on your next order!`
    : '';

  return (
    `💜 *We miss you, ${customerName}!*\n\n` +
    `It's been a while since you shopped at *${storeName}*.\n\n` +
    `We've got new arrivals waiting for you!${discountLine}\n\n` +
    `👉 ${storeUrl || 'Visit our store'}`
  );
};

// ─────────────────────────────────────────────
// REVIEW RATING PARSER (reused from Woo logic)
// ─────────────────────────────────────────────
export const parseShopifyReviewRating = (text) => {
  const match = String(text || '').trim().match(/^([1-5])(?:\s*(?:\/\s*5|stars?))?$/i);
  return match ? Number(match[1]) : null;
};
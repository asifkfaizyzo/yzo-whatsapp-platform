import axios from 'axios';

const REQUIRED_WEBHOOK_TOPICS = [
  'orders/create',              // 1.1 Order Confirmation ✅
  'orders/updated',             // 1.2 Payment Received (check financial_status)
  'orders/fulfilled',           // 1.3 Order Shipped
  'orders/cancelled',           // 1.6 Order Cancelled
  'orders/edited',              // 1.7 Order Edited
  'fulfillment_events/create',  // 1.4 & 1.5 Out for Delivery / Delivered
  'carts/create',               // Online-store cart created/added to
  'carts/update',               // Online-store cart updated
  'checkouts/create',           // Abandoned checkout created
  'checkouts/update',           // Abandoned checkout updated
  'customers/create',           // 🆕 New customer greeting
  'customers/update',           // 🆕 Customer information updated
  'products/create',            // 🆕 Product catalog sync — new product
  'products/update',            // 🆕 Product catalog sync + Back-in-Stock detection
  'products/delete',            // 🆕 Product catalog sync — product removed
  'inventory_levels/update',    // 🆕 Inventory quantity changes
];

/**
 * Get the public Webhook Endpoint URL
 */
const getWebhookCallbackUrl = () => {
  const configuredUrl = process.env.BACKEND_URL?.trim();
  if (!configuredUrl) {
    throw new Error('BACKEND_URL must be configured with Shopify-reachable HTTPS URL');
  }

  let backendUrl;
  try {
    backendUrl = new URL(configuredUrl);
  } catch {
    throw new Error('BACKEND_URL must be a valid Shopify-reachable HTTPS URL');
  }

  const isLocalhost =
    backendUrl.hostname === 'localhost' ||
    backendUrl.hostname.endsWith('.localhost') ||
    backendUrl.hostname === '127.0.0.1' ||
    backendUrl.hostname === '[::1]';

  if (backendUrl.protocol !== 'https:' || backendUrl.username || backendUrl.password || isLocalhost) {
    throw new Error('BACKEND_URL must be a public HTTPS URL without embedded credentials');
  }

  return `${backendUrl.toString().replace(/\/+$/, '')}/api2/shopify/webhooks`;
};

/**
 * Automatically register or update all required webhooks for a connected shop
 */
export const registerShopifyWebhooks = async (shopName, accessToken) => {
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
  const callbackUrl = getWebhookCallbackUrl();

  let cleanShop = shopName.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase();
  if (!cleanShop.includes('.')) cleanShop = `${cleanShop}.myshopify.com`;

  console.log(`\n📡 [Shopify Webhook] Syncing webhooks for ${cleanShop}`);
  console.log(`   👉 Target Address: ${callbackUrl}`);

  // 1. Fetch existing webhooks from Shopify
  let existingWebhooks = [];
  try {
    const existingRes = await axios.get(`https://${cleanShop}/admin/api/${apiVersion}/webhooks.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      timeout: 10000,
    });
    existingWebhooks = existingRes.data?.webhooks || [];
  } catch (err) {
    console.warn(`⚠️ [Shopify Webhook] Could not fetch existing webhooks: ${err.message}`);
  }

  // Map existing by topic -> webhook object
  const existingByTopic = {};
  for (const hook of existingWebhooks) {
    existingByTopic[hook.topic] = hook;
  }

  // 2. Register or Update required topics
  const results = [];
  for (const topic of REQUIRED_WEBHOOK_TOPICS) {
    const existingHook = existingByTopic[topic];

    // If webhook exists AND URL matches current callbackUrl, we are good!
    if (existingHook && existingHook.address === callbackUrl) {
      console.log(`✅ [Shopify Webhook] Topic '${topic}' is up-to-date (${callbackUrl})`);
      results.push({ topic, status: 'up_to_date', id: existingHook.id });
      continue;
    }

    // If webhook exists BUT URL is old, update it!
    if (existingHook && existingHook.address !== callbackUrl) {
      try {
        console.log(`🔄 [Shopify Webhook] Updating outdated URL for '${topic}'...`);
        const updateRes = await axios.put(
          `https://${cleanShop}/admin/api/${apiVersion}/webhooks/${existingHook.id}.json`,
          { webhook: { address: callbackUrl } },
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
        console.log(`🎉 [Shopify Webhook] Updated topic '${topic}' to: ${callbackUrl}`);
        results.push({ topic, status: 'updated', id: updateRes.data?.webhook?.id });
      } catch (err) {
        const errorMsg = err.response?.data?.errors || err.message;
        console.error(`❌ [Shopify Webhook] Failed to update topic '${topic}':`, errorMsg);
        results.push({ topic, status: 'failed', error: errorMsg });
      }
      continue;
    }

    // If webhook does not exist at all, create it!
    try {
      const createRes = await axios.post(
        `https://${cleanShop}/admin/api/${apiVersion}/webhooks.json`,
        {
          webhook: {
            topic,
            address: callbackUrl,
            format: 'json',
          },
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log(`🎉 [Shopify Webhook] Created new topic '${topic}' -> ${callbackUrl}`);
      results.push({ topic, status: 'created', id: createRes.data?.webhook?.id });
    } catch (err) {
      const errorMsg = err.response?.data?.errors || err.message;
      console.error(`❌ [Shopify Webhook] Failed to create topic '${topic}':`, errorMsg);
      results.push({ topic, status: 'failed', error: errorMsg });
    }
  }

  return results;
};
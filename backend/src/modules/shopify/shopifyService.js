import axios from 'axios';
import prisma from '../../config/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { registerShopifyWebhooks } from './shopifyWebhookService.js';


/**
 * Connect a Shopify Custom App for a tenant
 */
export const connect = async (tenantId, userId, { shopName, accessToken, webhookSecret }) => {
  if (typeof webhookSecret !== 'string' || !webhookSecret.trim()) {
    throw new Error('Shopify API secret is required to verify webhook signatures');
  }

  // 1. Sanitize shop domain
  let cleanShop = shopName
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
  if (!cleanShop.includes('.')) cleanShop = `${cleanShop}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleanShop)) {
    throw new Error('Enter a valid Shopify myshopify.com domain');
  }

  // 2. Validate credentials against Shopify Admin REST API
  try {
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';
    await axios.get(`https://${cleanShop}/admin/api/${apiVersion}/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (err) {
    const errorMsg =
      err.response?.data?.errors ||
      err.response?.statusText ||
      err.message ||
      'Could not verify Shopify store with provided credentials';
    throw new Error(`Shopify verification failed: ${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}`);
  }

  // 3. Upsert connection record (1 per tenant)
  const connection = await prisma.shopifyConnection.upsert({
    where: { tenantId },
    update: {
      shopName: cleanShop,
      accessToken: encrypt(accessToken),
      webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
      connectedBy: userId || null,
      status: 'active',
    },
    create: {
      tenantId,
      shopName: cleanShop,
      accessToken: encrypt(accessToken),
      webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
      connectedBy: userId || null,
      status: 'active',
    },
  });

   // 4. AUTOMATIC WEBHOOK REGISTRATION
  try {
     const webhookResults = await registerShopifyWebhooks(cleanShop, accessToken);
     const failedTopics = webhookResults.filter((result) => result.status === 'failed');
     if (failedTopics.length > 0) {
       console.error(
         `❌ Shopify webhook setup incomplete for ${cleanShop}:`,
         failedTopics.map(({ topic, error }) => `${topic} (${error})`).join('; ')
       );
     }
     if (failedTopics.some(({ topic }) => topic === 'checkouts/update')) {
       console.error(`❌ Abandoned-cart recovery will not receive checkout webhooks for ${cleanShop}`);
     }
   } catch (webhooksErr) {
     console.error('⚠️ Automatic webhook registration error:', webhooksErr.message);
   }

  return {
    id: connection.id,
    shopName: connection.shopName,
    status: connection.status,
    connectedAt: connection.connectedAt,
    hasWebhookSecret: Boolean(connection.webhookSecret),
  };
};

/**
 * Get Shopify connection status for a tenant
 */
export const getConnectionStatus = async (tenantId) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });

  if (!connection || connection.status !== 'active') {
    return {
      isConnected: false,
      status: connection?.status || 'not_connected',
      shopName: null,
      connectedAt: null,
      hasWebhookSecret: false,
    };
  }

  return {
    isConnected: true,
    status: connection.status,
    shopName: connection.shopName,
    connectedAt: connection.connectedAt,
    connectedBy: connection.connectedBy,
    hasWebhookSecret: Boolean(connection.webhookSecret),
    cartRecoveryEnabled: connection.cartRecoveryEnabled,
  };
};

export const updateCartRecoverySettings = async (tenantId, cartRecoveryEnabled) => {
  const connection = await prisma.shopifyConnection.update({
    where: { tenantId },
    data: { cartRecoveryEnabled },
    select: { cartRecoveryEnabled: true },
  });

  return connection;
};

/**
 * Disconnect Shopify integration
 */
export const disconnect = async (tenantId) => {
  const existing = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });

  if (!existing) {
    throw new Error('No active Shopify connection found for this tenant');
  }

  await prisma.shopifyConnection.delete({
    where: { tenantId },
  });

  return { success: true };
};
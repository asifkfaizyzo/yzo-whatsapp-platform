import axios from 'axios';
import prisma from '../../config/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';

/**
 * Connect a Shopify Custom App for a tenant
 */
export const connect = async (tenantId, userId, { shopName, accessToken, webhookSecret }) => {
  // 1. Sanitize shop domain
  const cleanShop = shopName
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();

  // 2. Validate credentials against Shopify Admin REST API
  try {
    await axios.get(`https://${cleanShop}/admin/api/2024-01/shop.json`, {
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
  };
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
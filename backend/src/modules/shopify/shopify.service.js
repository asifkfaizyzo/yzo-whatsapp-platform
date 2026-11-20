// backend/src/modules/shopify/shopify.service.js (do not remove this comment)
import axios from "axios";
import prisma from "../../config/prisma.js";
import { encrypt, decrypt } from "../../lib/crypto.js";
import { registerShopifyWebhooks } from "./webhooks/shopify.webhook.service.js";

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const pendingTokenRefreshes = new Map();

/**
 * Connect a Shopify app for a tenant
 */
export const connect = async (
  tenantId,
  userId,
  {
    shopName,
    accessToken,
    accessTokenExpiresAt = null,
    refreshToken = null,
    refreshTokenExpiresAt = null,
    webhookSecret,
  },
) => {
  if (typeof webhookSecret !== "string" || !webhookSecret.trim()) {
    throw new Error(
      "Shopify API secret is required to verify webhook signatures",
    );
  }

  // 1. Sanitize shop domain
  let cleanShop = shopName
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
  if (!cleanShop.includes(".")) cleanShop = `${cleanShop}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleanShop)) {
    throw new Error("Enter a valid Shopify myshopify.com domain");
  }

  // 2. Validate credentials against Shopify Admin REST API
   // 2. Validate credentials and retrieve Shopify store identity
  let shopifyShopId;

  try {
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";

    const response = await axios.get(
      `https://${cleanShop}/admin/api/${apiVersion}/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const rawShopId = response.data?.shop?.id;

    if (rawShopId === undefined || rawShopId === null) {
      throw new Error("Shopify response did not contain a shop ID");
    }

    shopifyShopId = String(rawShopId);
  } catch (err) {
    const errorMsg =
      err.response?.data?.errors ||
      err.response?.statusText ||
      err.message ||
      "Could not verify Shopify store with provided credentials";

    throw new Error(
      `Shopify verification failed: ${
        typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg)
      }`,
    );
  }

  // 3. Create/reuse Shopify store identity and link connection
  const connection = await prisma.$transaction(async (tx) => {
    const matchingStores = await tx.shopifyStore.findMany({
      where: {
        OR: [
          { shopDomain: cleanShop },
          { shopifyShopId },
        ],
      },
    });

    if (matchingStores.length > 1) {
      throw new Error(
        "Shopify store identity conflict: domain and shop ID belong to different records",
      );
    }

    let store = matchingStores[0];

    if (store) {
      if (
        store.shopDomain !== cleanShop ||
        (store.shopifyShopId &&
          store.shopifyShopId !== shopifyShopId)
      ) {
        throw new Error(
          "Shopify store identity mismatch. Please contact support.",
        );
      }

      if (store.tenantId && store.tenantId !== tenantId) {
        throw new Error(
          "This Shopify store is already connected to another SudoReply tenant.",
        );
      }

      store = await tx.shopifyStore.update({
        where: { id: store.id },
        data: {
          shopifyShopId,
          tenantId,
          status: "active",
          disconnectedAt: null,
        },
      });
    } else {
      store = await tx.shopifyStore.create({
        data: {
          shopifyShopId,
          shopDomain: cleanShop,
          tenantId,
          status: "active",
        },
      });
    }

    return tx.shopifyConnection.upsert({
      where: { tenantId },
      update: {
        storeId: store.id,
        shopName: cleanShop,
        accessToken: encrypt(accessToken),
        accessTokenExpiresAt,
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        refreshTokenExpiresAt,
        webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
        connectedBy: userId || null,
        status: "active",
      },
      create: {
        tenantId,
        storeId: store.id,
        shopName: cleanShop,
        accessToken: encrypt(accessToken),
        accessTokenExpiresAt,
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        refreshTokenExpiresAt,
        webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
        connectedBy: userId || null,
        status: "active",
      },
    });
  });

  // 4. AUTOMATIC WEBHOOK REGISTRATION
  try {
    const webhookResults = await registerShopifyWebhooks(
      cleanShop,
      accessToken,
    );
    const failedTopics = webhookResults.filter(
      (result) => result.status === "failed",
    );
    if (failedTopics.length > 0) {
      console.error(
        `❌ Shopify webhook setup incomplete for ${cleanShop}:`,
        failedTopics
          .map(({ topic, error }) => `${topic} (${error})`)
          .join("; "),
      );
    }
    if (failedTopics.some(({ topic }) => topic === "checkouts/update")) {
      console.error(
        `❌ Abandoned-cart recovery will not receive checkout webhooks for ${cleanShop}`,
      );
    }
  } catch (webhooksErr) {
    console.error(
      "⚠️ Automatic webhook registration error:",
      webhooksErr.message,
    );
  }

  return {
    id: connection.id,
    shopName: connection.shopName,
    status: connection.status,
    connectedAt: connection.connectedAt,
    hasWebhookSecret: Boolean(connection.webhookSecret),
  };
};

export const getShopifyAccessToken = async (tenantId) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });
  if (!connection || connection.status !== "active") {
    throw new Error("No active Shopify connection found for this tenant");
  }

  if (!connection.refreshToken) {
    return decrypt(connection.accessToken);
  }
  if (!connection.accessTokenExpiresAt || !connection.refreshTokenExpiresAt) {
    throw new Error(
      "Shopify token expiry information is missing. Reconnect the Shopify store.",
    );
  }
  if (
    connection.accessTokenExpiresAt.getTime() >
    Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS
  ) {
    return decrypt(connection.accessToken);
  }

  const pendingRefresh = pendingTokenRefreshes.get(tenantId);
  if (pendingRefresh) return pendingRefresh;

  const refreshPromise = (async () => {
    const latestConnection = await prisma.shopifyConnection.findUnique({
      where: { tenantId },
    });
    if (!latestConnection || latestConnection.status !== "active") {
      throw new Error("No active Shopify connection found for this tenant");
    }
    if (
      !latestConnection.refreshToken ||
      !latestConnection.accessTokenExpiresAt ||
      !latestConnection.refreshTokenExpiresAt
    ) {
      throw new Error(
        "Shopify token expiry information is missing. Reconnect the Shopify store.",
      );
    }
    if (
      latestConnection.accessTokenExpiresAt.getTime() >
      Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS
    ) {
      return decrypt(latestConnection.accessToken);
    }
    if (latestConnection.refreshTokenExpiresAt.getTime() <= Date.now()) {
      throw new Error("Shopify refresh token expired. Reconnect the store.");
    }

    const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET } = process.env;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      throw new Error(
        "SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be configured",
      );
    }

    const response = await axios.post(
  `https://${latestConnection.shopName}/admin/oauth/access_token`,
  new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    grant_type: "refresh_token",
    refresh_token: decrypt(latestConnection.refreshToken),
  }),
  {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    timeout: 10000,
  },
);

    const {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: refreshToken,
      refresh_token_expires_in: refreshTokenExpiresIn,
    } = response.data || {};
    if (
      !accessToken ||
      !refreshToken ||
      !Number.isFinite(expiresIn) ||
      !Number.isFinite(refreshTokenExpiresIn)
    ) {
      throw new Error(
        "Shopify did not return refreshed expiring offline token credentials",
      );
    }

    const refreshedAt = Date.now();
    await prisma.shopifyConnection.update({
      where: { tenantId },
      data: {
        accessToken: encrypt(accessToken),
        accessTokenExpiresAt: new Date(refreshedAt + expiresIn * 1000),
        refreshToken: encrypt(refreshToken),
        refreshTokenExpiresAt: new Date(
          refreshedAt + refreshTokenExpiresIn * 1000,
        ),
      },
    });

    return accessToken;
  })();

  pendingTokenRefreshes.set(tenantId, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    pendingTokenRefreshes.delete(tenantId);
  }
};

/**
 * Get Shopify connection status for a tenant
 */
export const getConnectionStatus = async (tenantId) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });

  if (!connection || connection.status !== "active") {
    return {
      isConnected: false,
      status: connection?.status || "not_connected",
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

export const updateCartRecoverySettings = async (
  tenantId,
  cartRecoveryEnabled,
) => {
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
    throw new Error("No active Shopify connection found for this tenant");
  }

  await prisma.shopifyConnection.delete({
    where: { tenantId },
  });

  return { success: true };
};

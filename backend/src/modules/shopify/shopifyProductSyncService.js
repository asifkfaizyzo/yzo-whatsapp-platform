import axios from 'axios';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';

/**
 * Fetch shop-level currency from Shopify
 */
const getShopCurrency = async (shopName, accessToken) => {
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';
  try {
    const res = await axios.get(`https://${shopName}/admin/api/${apiVersion}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      timeout: 10000,
    });
    return res.data?.shop?.currency || 'INR';
  } catch {
    return 'INR';
  }
};

/**
 * Derive availability string from variant data
 */
const deriveAvailability = (variant) => {
  if (variant.inventory_policy === 'continue') return 'in_stock';
  return (variant.inventory_quantity || 0) > 0 ? 'in_stock' : 'out_of_stock';
};

/**
 * Map Shopify status string to our enum
 */
const mapStatus = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'ACTIVE';
  if (s === 'DRAFT') return 'DRAFT';
  if (s === 'ARCHIVED') return 'ARCHIVED';
  return 'ACTIVE';
};

/**
 * Upsert a single product with its variants and images.
 * Used by both full sync and webhook handlers.
 */
export const upsertProduct = async (tenantId, shopifyProduct, shopDomain, currency) => {
  const shopifyProductId = String(shopifyProduct.id);
  const handle = shopifyProduct.handle || '';
  const productUrl = `https://${shopDomain}/products/${handle}`;

  // 1. Upsert the product record
  const product = await prisma.shopifyProduct.upsert({
    where: {
      tenantId_shopifyProductId: {
        tenantId,
        shopifyProductId,
      },
    },
    update: {
      title: shopifyProduct.title || 'Untitled',
      bodyHtml: shopifyProduct.body_html || null,
      handle,
      productUrl,
      vendor: shopifyProduct.vendor || null,
      productType: shopifyProduct.product_type || null,
      tags: Array.isArray(shopifyProduct.tags)
        ? shopifyProduct.tags.join(', ')
        : shopifyProduct.tags || null,
      status: mapStatus(shopifyProduct.status),
      syncStatus: 'SYNCED',
      syncError: null,
      lastSyncedAt: new Date(),
      shopifyUpdatedAt: shopifyProduct.updated_at
        ? new Date(shopifyProduct.updated_at)
        : null,
    },
    create: {
      tenantId,
      shopifyProductId,
      title: shopifyProduct.title || 'Untitled',
      bodyHtml: shopifyProduct.body_html || null,
      handle,
      productUrl,
      vendor: shopifyProduct.vendor || null,
      productType: shopifyProduct.product_type || null,
      tags: Array.isArray(shopifyProduct.tags)
        ? shopifyProduct.tags.join(', ')
        : shopifyProduct.tags || null,
      status: mapStatus(shopifyProduct.status),
      syncStatus: 'SYNCED',
      lastSyncedAt: new Date(),
      shopifyUpdatedAt: shopifyProduct.updated_at
        ? new Date(shopifyProduct.updated_at)
        : null,
    },
  });

  // 2. Replace variants (delete old, create new)
  await prisma.shopifyProductVariant.deleteMany({
    where: { productId: product.id },
  });

  const variants = shopifyProduct.variants || [];
  if (variants.length > 0) {
    await prisma.shopifyProductVariant.createMany({
      data: variants.map((v) => ({
        productId: product.id,
        shopifyVariantId: String(v.id),
        title: v.title || null,
        sku: v.sku || null,
        price: parseFloat(v.price) || 0,
        compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
        currency,
        inventoryQuantity: v.inventory_quantity || 0,
        inventoryPolicy: v.inventory_policy || null,
        availability: deriveAvailability(v),
        weight: v.weight ? parseFloat(v.weight) : null,
        weightUnit: v.weight_unit || null,
        requiresShipping: v.requires_shipping ?? true,
        taxable: v.taxable ?? true,
        barcode: v.barcode || null,
        option1: v.option1 || null,
        option2: v.option2 || null,
        option3: v.option3 || null,
        shopifyUpdatedAt: v.updated_at ? new Date(v.updated_at) : null,
      })),
    });
  }

  // 3. Replace images (delete old, create new)
  await prisma.shopifyProductImage.deleteMany({
    where: { productId: product.id },
  });

  const images = shopifyProduct.images || [];
  if (images.length > 0) {
    await prisma.shopifyProductImage.createMany({
      data: images.map((img) => ({
        productId: product.id,
        shopifyImageId: String(img.id),
        src: img.src || '',
        alt: img.alt || null,
        position: img.position || 1,
        width: img.width || null,
        height: img.height || null,
      })),
    });
  }

  return product;
};

/**
 * Mark a product as deleted (from webhook)
 */
export const markProductDeleted = async (tenantId, shopifyProductId) => {
  try {
    await prisma.shopifyProduct.updateMany({
      where: {
        tenantId,
        shopifyProductId: String(shopifyProductId),
      },
      data: {
        status: 'ARCHIVED',
        syncStatus: 'DELETED',
        lastSyncedAt: new Date(),
      },
    });
    console.log(`🗑️ [Shopify Product] Marked product ${shopifyProductId} as deleted`);
  } catch (err) {
    console.error(`❌ [Shopify Product] Failed to mark deleted:`, err.message);
  }
};

/**
 * Full sync: Fetch ALL products from Shopify and upsert into DB.
 * Uses cursor pagination (same pattern as customer sync).
 */
export const syncAllProducts = async (tenantId) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });

  if (!connection || connection.status !== 'active') {
    throw new Error('No active Shopify connection found for this tenant');
  }

  const shopName = connection.shopName;
  const accessToken = decrypt(connection.accessToken);
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';

  // 1. Get shop currency once
  const currency = await getShopCurrency(shopName, accessToken);

  // 2. Paginate through all products
  let pageInfo = null;
  let hasNextPage = true;
  let totalSynced = 0;
  let totalErrors = 0;

  console.log(`🚀 [Shopify Product Sync] Starting full sync for ${shopName}...`);

  while (hasNextPage) {
    let url = `https://${shopName}/admin/api/${apiVersion}/products.json?limit=250`;
    if (pageInfo) {
      url += `&page_info=${pageInfo}`;
    }

    try {
      const response = await axios.get(url, {
        headers: { 'X-Shopify-Access-Token': accessToken },
        timeout: 30000,
      });

      const products = response.data?.products || [];

      for (const shopifyProduct of products) {
        try {
          await upsertProduct(tenantId, shopifyProduct, shopName, currency);
          totalSynced++;
        } catch (err) {
          totalErrors++;
          console.error(
            `❌ [Shopify Product Sync] Error syncing product ${shopifyProduct.id}:`,
            err.message
          );
        }
      }

      // Parse Link header for cursor pagination
      const linkHeader = response.headers['link'] || response.headers['Link'];
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^>&]+)>;\s*rel="next"/);
        pageInfo = match ? match[1] : null;
        hasNextPage = Boolean(pageInfo);
      } else {
        hasNextPage = false;
      }
    } catch (err) {
      console.error(`❌ [Shopify Product Sync] API error:`, err.message);
      throw new Error(`Shopify API error during product sync: ${err.message}`);
    }
  }

  console.log(
    `🎉 [Shopify Product Sync] Completed. Synced: ${totalSynced}, Errors: ${totalErrors}`
  );

  return { totalSynced, totalErrors, currency };
};

/**
 * Get products for a tenant (for dashboard listing)
 */
export const getProducts = async (tenantId, { page = 1, limit = 20, status, search } = {}) => {
  const where = { tenantId };

  if (status) {
    where.status = status;
  } else {
    where.syncStatus = { not: 'DELETED' };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { handle: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.shopifyProduct.findMany({
      where,
      include: {
        variants: {
          orderBy: { price: 'asc' },
        },
        images: {
          orderBy: { position: 'asc' },
          take: 3,
        },
      },
      orderBy: { lastSyncedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.shopifyProduct.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get single product detail
 */
export const getProductDetail = async (tenantId, shopifyProductId) => {
  return prisma.shopifyProduct.findUnique({
    where: {
      tenantId_shopifyProductId: {
        tenantId,
        shopifyProductId: String(shopifyProductId),
      },
    },
    include: {
      variants: {
        orderBy: { price: 'asc' },
      },
      images: {
        orderBy: { position: 'asc' },
      },
    },
  });
};
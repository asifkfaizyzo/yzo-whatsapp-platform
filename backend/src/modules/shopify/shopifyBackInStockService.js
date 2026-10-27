import prisma from '../../config/prisma.js';
import { processBroadcastCampaign } from '../broadcasts/broadcastService.js';
import { emitToTenant } from '../../lib/socket.js';

/**
 * Handle products/update webhook for Back-in-Stock detection.
 *
 * Logic:
 * 1. Parse product variants and their inventory
 * 2. Check if any variant has stock > 0
 * 3. Find BackInStockSubscription records for this product
 * 4. Auto-create a broadcast campaign and send via existing queue/worker
 */
export const handleProductUpdateForBackInStock = async (tenantId, payload, shopDomain) => {
  try {
    const productId = String(payload.id);
    const productTitle = payload.title || 'Product';
    const productHandle = payload.handle || '';

    // 1. Check current inventory levels across all variants
    const variants = payload.variants || [];
    let hasStockNow = false;

    for (const variant of variants) {
      const inventoryQty = variant.inventory_quantity ?? 0;
      if (inventoryQty > 0) {
        hasStockNow = true;
        break;
      }
    }

    if (!hasStockNow) {
      return { triggered: false, reason: 'still_out_of_stock' };
    }

    // 2. Find unnotified subscriptions for this product
    const subscriptions = await prisma.backInStockSubscription.findMany({
      where: {
        tenantId,
        shopifyProductId: productId,
        notified: false,
      },
    });

    if (subscriptions.length === 0) {
      return { triggered: false, reason: 'no_subscribers' };
    }

    console.log(`🔔 [BackInStock] "${productTitle}" (ID: ${productId}) is back in stock! ${subscriptions.length} subscribers.`);

    // 3. Get or create contacts for subscribers
    const phones = subscriptions.map(s => s.contactPhone);
    const existingContacts = await prisma.contact.findMany({
      where: { tenantId, phone: { in: phones } },
    });

    const existingMap = new Map(existingContacts.map(c => [c.phone, c]));
    const contacts = [];

    for (const sub of subscriptions) {
      if (existingMap.has(sub.contactPhone)) {
        contacts.push(existingMap.get(sub.contactPhone));
      } else {
        try {
          const created = await prisma.contact.create({
            data: {
              tenantId,
              phone: sub.contactPhone,
              name: 'Back-in-Stock Subscriber',
              isActive: true,
            },
          });
          contacts.push(created);
        } catch (err) {
          console.warn(`🔔 [BackInStock] Contact creation failed for ${sub.contactPhone}:`, err.message);
        }
      }
    }

    if (contacts.length === 0) {
      return { triggered: false, reason: 'no_valid_contacts' };
    }

    // 4. Get tenant WhatsApp config
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
      console.warn(`🔔 [BackInStock] Tenant ${tenantId} has no WhatsApp config. Skipping.`);
      return { triggered: false, reason: 'no_whatsapp_config' };
    }

    // 5. Find a usable template (works in both DEV and PROD)
    const isDev = process.env.NODE_ENV !== 'production';
    const validStatuses = isDev
      ? ['DRAFT', 'PENDING', 'APPROVED']
      : ['APPROVED'];

    let template = await prisma.template.findFirst({
      where: {
        tenantId,
        name: { contains: 'back_in_stock', mode: 'insensitive' },
        status: { in: validStatuses },
      },
    });

    if (!template) {
      template = await prisma.template.findFirst({
        where: {
          tenantId,
          status: { in: validStatuses },
          category: 'MARKETING',
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!template && isDev) {
      template = await prisma.template.findFirst({
        where: {
          tenantId,
          status: { not: 'DELETED' },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!template) {
      console.warn(`🔔 [BackInStock] No usable template found for tenant ${tenantId}. Create a template first.`);
      return { triggered: false, reason: 'no_template' };
    }

    console.log(`🔔 [BackInStock] Using template "${template.name}" (status: ${template.status}, mode: ${isDev ? 'DEV' : 'PROD'})`);

    // 6. Build product URL
    const productUrl = productHandle
      ? `https://${shopDomain}/products/${productHandle}`
      : `https://${shopDomain}`;

    // 7. Create broadcast campaign (reuses existing Broadcast model)
    const campaign = await prisma.broadcast.create({
      data: {
        tenantId,
        name: `Back in Stock: ${productTitle}`,
        templateId: template.id,
        targetType: 'SHOPIFY_SEGMENT',
        campaignType: 'BACK_IN_STOCK',
        shopifyProductId: productId,
        shopifyProductTitle: productTitle,
        shopifyProductUrl: productUrl,
        defaultParams: {
          body: [productTitle, productUrl],
        },
        status: 'PROCESSING',
        totalRecipients: contacts.length,
      },
    });

    // 8. Create recipient records
    await prisma.broadcastRecipient.createMany({
      data: contacts.map(c => ({
        broadcastId: campaign.id,
        contactId: c.id,
        status: 'PENDING',
        params: { body: [productTitle, productUrl] },
      })),
    });

    // 9. Mark subscriptions as notified
    await prisma.backInStockSubscription.updateMany({
      where: { id: { in: subscriptions.map(s => s.id) } },
      data: {
        notified: true,
        notifiedAt: new Date(),
        broadcastId: campaign.id,
      },
    });

    // 10. Queue the broadcast (reuses existing broadcastQueue + broadcastWorker!)
    processBroadcastCampaign(
      campaign.id,
      tenant,
      contacts,
      template,
      { body: [productTitle, productUrl] },
      0
    );

    emitToTenant(tenantId, 'broadcast_update', {
      broadcastId: campaign.id,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      status: 'PROCESSING',
      campaignType: 'BACK_IN_STOCK',
      productTitle,
    });

    console.log(`🎉 [BackInStock] Auto-broadcast launched for "${productTitle}" to ${contacts.length} subscribers!`);

    return {
      triggered: true,
      campaignId: campaign.id,
      recipientsCount: contacts.length,
      productTitle,
    };
  } catch (error) {
    console.error('💥 [BackInStock] Error handling product update:', error);
    return { triggered: false, reason: 'error', error: error.message };
  }
};

/**
 * Subscribe a customer to back-in-stock notifications
 */
export const subscribeToBackInStock = async (tenantId, { phone, productId, variantId, productTitle, productHandle }) => {
  if (!phone || !productId || !productTitle) {
    throw new Error('phone, productId, and productTitle are required');
  }

  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

  const subscription = await prisma.backInStockSubscription.upsert({
    where: {
      tenantId_contactPhone_shopifyProductId: {
        tenantId,
        contactPhone: formattedPhone,
        shopifyProductId: String(productId),
      },
    },
    update: {
      notified: false,
      notifiedAt: null,
      broadcastId: null,
      productTitle,
      productHandle: productHandle || null,
      shopifyVariantId: variantId ? String(variantId) : null,
    },
    create: {
      tenantId,
      contactPhone: formattedPhone,
      shopifyProductId: String(productId),
      shopifyVariantId: variantId ? String(variantId) : null,
      productTitle,
      productHandle: productHandle || null,
    },
  });

  return subscription;
};

/**
 * Unsubscribe a customer from back-in-stock notifications
 */
export const unsubscribeFromBackInStock = async (tenantId, { phone, productId }) => {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

  await prisma.backInStockSubscription.deleteMany({
    where: {
      tenantId,
      contactPhone: formattedPhone,
      shopifyProductId: String(productId),
    },
  });

  return { success: true };
};

/**
 * Get all back-in-stock subscriptions for a tenant (admin view)
 */
export const getBackInStockSubscriptions = async (tenantId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  const [subscriptions, total] = await Promise.all([
    prisma.backInStockSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.backInStockSubscription.count({ where: { tenantId } }),
  ]);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
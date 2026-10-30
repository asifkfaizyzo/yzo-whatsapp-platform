import * as shopifyService from './shopifyService.js';
import * as backInStockService from './shopifyBackInStockService.js';
import { syncAllShopifyCustomers } from './shopifyCustomerSyncService.js';
import { syncAllProducts } from './shopifyProductSyncService.js';

export const connect = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const userId = req.user?.id || req.tenant?.id;
    const { shopName, accessToken, webhookSecret } = req.body;

    if (!shopName || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Shop domain and Admin API access token are required',
      });
    }

        const data = await shopifyService.connect(tenantId, userId, {
      shopName,
      accessToken,
      webhookSecret,
    });

    // 🆕 Auto-trigger initial product catalog sync (non-blocking)
    syncAllProducts(tenantId)
      .then((result) => {
        console.log(`🚀 [Connect] Initial product sync completed: ${result.totalSynced} products`);
      })
      .catch((err) => {
        console.error('⚠️ [Connect] Initial product sync failed:', err.message);
      });

    return res.json({
      success: true,
      message: 'Shopify connected successfully',
      data,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const status = await shopifyService.getConnectionStatus(tenantId);
    return res.json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCartRecoverySettings = async (req, res) => {
  const cartRecoveryEnabled = req.body?.cartRecoveryEnabled;
  if (typeof cartRecoveryEnabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'cartRecoveryEnabled must be a boolean',
    });
  }

  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const settings = await shopifyService.updateCartRecoverySettings(
      tenantId,
      cartRecoveryEnabled,
    );
    return res.json({ success: true, data: settings });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Shopify store is not connected' });
    }
    console.error('Error updating Shopify cart recovery settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Shopify cart recovery settings',
    });
  }
};

export const disconnect = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    await shopifyService.disconnect(tenantId);
    return res.json({ success: true, message: 'Shopify disconnected successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ── Back-in-Stock Subscription Endpoints ──

export const subscribeBackInStock = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { phone, productId, variantId, productTitle, productHandle } = req.body;

    if (!phone || !productId || !productTitle) {
      return res.status(400).json({
        success: false,
        message: 'phone, productId, and productTitle are required',
      });
    }

    const subscription = await backInStockService.subscribeToBackInStock(tenantId, {
      phone,
      productId,
      variantId,
      productTitle,
      productHandle,
    });

    return res.status(201).json({
      success: true,
      message: 'Subscribed to back-in-stock notification',
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const unsubscribeBackInStock = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { phone, productId } = req.body;

    if (!phone || !productId) {
      return res.status(400).json({
        success: false,
        message: 'phone and productId are required',
      });
    }

    await backInStockService.unsubscribeFromBackInStock(tenantId, { phone, productId });

    return res.json({ success: true, message: 'Unsubscribed from back-in-stock notification' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBackInStockSubscriptions = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));

    const result = await backInStockService.getBackInStockSubscriptions(tenantId, { page, limit });

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ── Category 5: Bulk Customer Sync Endpoint ──

export const triggerCustomerSync = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant ID is required' });
    }

    const result = await syncAllShopifyCustomers(tenantId);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${result.totalSynced} Shopify customers.`,
      data: result,
    });
  } catch (error) {
    console.error('❌ [Shopify Controller] Bulk customer sync error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};


export async function getPostPurchaseSettings(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const conn = await prisma.shopifyConnection.findFirst({
      where: { tenantId, status: 'active' },
      select: {
        postPurchaseReviewEnabled: true,
        postPurchaseReviewDelayDays: true,
        postPurchaseCrossSellEnabled: true,
        postPurchaseUpsellEnabled: true,
        postPurchaseReorderEnabled: true,
        postPurchaseReorderDays: true,
        postPurchaseWinBackEnabled: true,
        postPurchaseWinBackDays: true,
      },
    });
    if (!conn) {
      return res.status(404).json({ success: false, message: 'Shopify not connected' });
    }
    return res.json({ success: true, data: conn });
  } catch (err) {
    console.error('getPostPurchaseSettings error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updatePostPurchaseSettings(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const conn = await prisma.shopifyConnection.findFirst({
      where: { tenantId, status: 'active' },
    });
    if (!conn) {
      return res.status(404).json({ success: false, message: 'Shopify not connected' });
    }

    const b = req.body || {};
    const updated = await prisma.shopifyConnection.update({
      where: { id: conn.id },
      data: {
        ...(typeof b.postPurchaseReviewEnabled === 'boolean' && { postPurchaseReviewEnabled: b.postPurchaseReviewEnabled }),
        ...(b.postPurchaseReviewDelayDays != null && { postPurchaseReviewDelayDays: Number(b.postPurchaseReviewDelayDays) }),
        ...(typeof b.postPurchaseCrossSellEnabled === 'boolean' && { postPurchaseCrossSellEnabled: b.postPurchaseCrossSellEnabled }),
        ...(typeof b.postPurchaseUpsellEnabled === 'boolean' && { postPurchaseUpsellEnabled: b.postPurchaseUpsellEnabled }),
        ...(typeof b.postPurchaseReorderEnabled === 'boolean' && { postPurchaseReorderEnabled: b.postPurchaseReorderEnabled }),
        ...(b.postPurchaseReorderDays != null && { postPurchaseReorderDays: Number(b.postPurchaseReorderDays) }),
        ...(typeof b.postPurchaseWinBackEnabled === 'boolean' && { postPurchaseWinBackEnabled: b.postPurchaseWinBackEnabled }),
        ...(b.postPurchaseWinBackDays != null && { postPurchaseWinBackDays: Number(b.postPurchaseWinBackDays) }),
      },
      select: {
        postPurchaseReviewEnabled: true,
        postPurchaseReviewDelayDays: true,
        postPurchaseCrossSellEnabled: true,
        postPurchaseUpsellEnabled: true,
        postPurchaseReorderEnabled: true,
        postPurchaseReorderDays: true,
        postPurchaseWinBackEnabled: true,
        postPurchaseWinBackDays: true,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('updatePostPurchaseSettings error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
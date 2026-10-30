import {
  syncAllProducts,
  getProducts,
  getProductDetail,
} from './shopifyProductSyncService.js';

/**
 * POST /api2/shopify/products/sync
 * Trigger full product sync from Shopify
 */
export const triggerProductSync = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await syncAllProducts(tenantId);

    return res.status(200).json({
      success: true,
      message: `Product sync completed`,
      data: result,
    });
  } catch (err) {
    console.error('💥 [Product Sync Controller]', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Product sync failed',
    });
  }
};

/**
 * GET /api2/shopify/products
 * List synced products with pagination
 */
export const listProducts = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { page = 1, limit = 20, status, search } = req.query;

    const result = await getProducts(tenantId, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      status: status || undefined,
      search: search || undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('💥 [Product List Controller]', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
};

/**
 * GET /api2/shopify/products/:shopifyProductId
 * Get single product detail
 */
export const getProduct = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { shopifyProductId } = req.params;
    const product = await getProductDetail(tenantId, shopifyProductId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error('💥 [Product Detail Controller]', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
    });
  }
};
import * as shopifyService from './shopifyService.js';

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

export const disconnect = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    await shopifyService.disconnect(tenantId);
    return res.json({ success: true, message: 'Shopify disconnected successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
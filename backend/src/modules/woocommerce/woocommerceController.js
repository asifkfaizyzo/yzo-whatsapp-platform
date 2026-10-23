import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import { autoProvisionWebhooks } from './woocommerceService.js';

export const getWooCommerceAuthWebhookConfig = async (req, res) => {
  try {
    if (req.userType !== 'TENANT') {
      return res.status(403).json({ success: false, message: 'Only the tenant owner can access webhook configuration' });
    }

    const tenantId = req.tenantId;
    let connection = await prisma.wooCommerceConnection.findUnique({ where: { tenantId } });
    if (!connection || connection.status.toUpperCase() !== 'CONNECTED') {
      return res.status(404).json({ success: false, message: 'Connect WooCommerce before configuring auth alerts' });
    }

    if (!connection.webhookSecret) {
      await prisma.wooCommerceConnection.updateMany({
        where: { tenantId, webhookSecret: null },
        data: { webhookSecret: crypto.randomBytes(32).toString('hex') },
      });
      connection = await prisma.wooCommerceConnection.findUnique({ where: { tenantId } });
    }

    const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/+$/, '');
    if (!backendUrl) {
      return res.status(503).json({ success: false, message: 'BACKEND_URL must be configured before setting up WooCommerce auth events' });
    }

    return res.json({
      success: true,
      data: {
        tenantId,
        endpoint: `${backendUrl}/api2/woocommerce/auth-events?tenantId=${encodeURIComponent(tenantId)}`,
        signingSecret: connection.webhookSecret,
      },
    });
  } catch (error) {
    console.error('Error creating WooCommerce auth webhook configuration:', error);
    return res.status(500).json({ success: false, message: 'Failed to load WooCommerce auth webhook configuration' });
  }
};

export const getWooCommerceCartRecoveryWebhookConfig = async (req, res) => {
  try {
    if (req.userType !== 'TENANT') {
      return res.status(403).json({ success: false, message: 'Only the tenant owner can access cart recovery webhook configuration' });
    }

    const tenantId = req.tenantId;
    let connection = await prisma.wooCommerceConnection.findUnique({ where: { tenantId } });
    if (!connection || !['CONNECTED', 'ACTIVE'].includes(String(connection.status).toUpperCase())) {
      return res.status(404).json({ success: false, message: 'Connect WooCommerce before configuring cart recovery' });
    }
    if (!connection.webhookSecret) {
      await prisma.wooCommerceConnection.update({
        where: { tenantId },
        data: { webhookSecret: crypto.randomBytes(32).toString('hex') },
      });
      connection = await prisma.wooCommerceConnection.findUnique({ where: { tenantId } });
    }

    const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/+$/, '');
    if (!backendUrl) {
      return res.status(503).json({ success: false, message: 'BACKEND_URL must be configured before setting up WooCommerce cart recovery' });
    }
    let parsedBackendUrl;
    try {
      parsedBackendUrl = new URL(backendUrl);
    } catch {
      return res.status(503).json({ success: false, message: 'BACKEND_URL must be a valid URL' });
    }
    if (parsedBackendUrl.protocol !== 'https:') {
      return res.status(503).json({ success: false, message: 'BACKEND_URL must use HTTPS for WooCommerce cart recovery' });
    }

    return res.json({
      success: true,
      data: {
        tenantId,
        endpoint: `${backendUrl}/api2/woocommerce/cart-events?tenantId=${encodeURIComponent(tenantId)}`,
        signingSecret: connection.webhookSecret,
        storeUrl: connection.storeUrl,
      },
    });
  } catch (error) {
    console.error('Error creating WooCommerce cart recovery webhook configuration:', error);
    return res.status(500).json({ success: false, message: 'Failed to load WooCommerce cart recovery webhook configuration' });
  }
};

export const getWooCommerceStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const connection = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      return res.json({ success: true, data: { isConnected: false } });
    }

    return res.json({
      success: true,
      data: {
        isConnected: ['ACTIVE', 'CONNECTED'].includes(String(connection.status).toUpperCase()),
        storeUrl: connection.storeUrl, // ✅ Corrected from connection.wpUrl to connection.storeUrl
        connectedAt: connection.createdAt,
        status: connection.status,
        trackingUrlTemplates: connection.trackingUrlTemplates || {},
        alertPhone: connection.alertPhone || '',
        newOrderAlert: connection.newOrderAlert ?? true,
        lowStockAlert: connection.lowStockAlert ?? false,
        lowStockThreshold: connection.lowStockThreshold ?? 5,
        dailySummaryAlert: connection.dailySummaryAlert ?? false,
        dailySummaryHour: connection.dailySummaryHour ?? 20,
        cartRecoveryEnabled: connection.cartRecoveryEnabled,
        cartReminder1Enabled: connection.cartReminder1Enabled,
        cartReminder24Enabled: connection.cartReminder24Enabled,
        cartReminder48Enabled: connection.cartReminder48Enabled,
        cartReminder1Text: connection.cartReminder1Text || '',
        cartReminder24Text: connection.cartReminder24Text || '',
        cartReminder48Text: connection.cartReminder48Text || '',
        cartDiscountCode: connection.cartDiscountCode || '',
        cartDiscountLabel: connection.cartDiscountLabel || '',
        cartIncludeImage: connection.cartIncludeImage,
      },
    });
  } catch (error) {
    console.error('Error fetching WooCommerce status:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateWooCommerceCartRecoverySettings = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const {
      cartRecoveryEnabled,
      cartReminder1Enabled,
      cartReminder24Enabled,
      cartReminder48Enabled,
      cartReminder1Text,
      cartReminder24Text,
      cartReminder48Text,
      cartDiscountCode,
      cartDiscountLabel,
      cartIncludeImage,
    } = req.body || {};
    const textFields = {
      cartReminder1Text,
      cartReminder24Text,
      cartReminder48Text,
    };
    for (const [field, value] of Object.entries({
      cartRecoveryEnabled,
      cartReminder1Enabled,
      cartReminder24Enabled,
      cartReminder48Enabled,
      cartIncludeImage,
    })) {
      if (value !== undefined && typeof value !== 'boolean') {
        return res.status(400).json({ success: false, message: `${field} must be a boolean` });
      }
    }
    for (const [field, value] of Object.entries(textFields)) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 4000)) {
        return res.status(400).json({ success: false, message: `${field} must be text no longer than 4000 characters` });
      }
    }
    for (const [field, value] of Object.entries({ cartDiscountCode, cartDiscountLabel })) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 100)) {
        return res.status(400).json({ success: false, message: `${field} must be text no longer than 100 characters` });
      }
    }

    const updated = await prisma.wooCommerceConnection.update({
      where: { tenantId },
      data: {
        ...(typeof cartRecoveryEnabled === 'boolean' && { cartRecoveryEnabled }),
        ...(typeof cartReminder1Enabled === 'boolean' && { cartReminder1Enabled }),
        ...(typeof cartReminder24Enabled === 'boolean' && { cartReminder24Enabled }),
        ...(typeof cartReminder48Enabled === 'boolean' && { cartReminder48Enabled }),
        ...Object.fromEntries(Object.entries(textFields).filter(([, value]) => value !== undefined)),
        ...(cartDiscountCode !== undefined && { cartDiscountCode: cartDiscountCode.trim() || null }),
        ...(cartDiscountLabel !== undefined && { cartDiscountLabel: cartDiscountLabel.trim() || null }),
        ...(typeof cartIncludeImage === 'boolean' && { cartIncludeImage }),
      },
      select: {
        cartRecoveryEnabled: true,
        cartReminder1Enabled: true,
        cartReminder24Enabled: true,
        cartReminder48Enabled: true,
        cartReminder1Text: true,
        cartReminder24Text: true,
        cartReminder48Text: true,
        cartDiscountCode: true,
        cartDiscountLabel: true,
        cartIncludeImage: true,
      },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating WooCommerce cart recovery settings:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'WooCommerce store is not connected' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update cart recovery settings' });
  }
};

export const saveWooCommerceTrackingUrlTemplates = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const templates = req.body?.templates;
    if (!Array.isArray(templates)) {
      return res.status(400).json({ success: false, message: 'Courier tracking templates must be an array' });
    }

    const normalized = {};
    for (const entry of templates) {
      const provider = String(entry?.provider || '').trim();
      const urlTemplate = String(entry?.urlTemplate || '').trim();
      if (!provider || !urlTemplate) {
        return res.status(400).json({ success: false, message: 'Each courier requires a name and tracking URL template' });
      }
      if (provider.length > 80 || urlTemplate.length > 2048) {
        return res.status(400).json({ success: false, message: 'Courier names must be 80 characters or fewer and URL templates 2048 characters or fewer' });
      }
      if (!urlTemplate.includes('{{tracking_number}}')) {
        return res.status(400).json({ success: false, message: 'Each URL template must include {{tracking_number}}' });
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(urlTemplate.replace(/\{\{tracking_number\}\}/g, 'test-tracking-number'));
      } catch {
        return res.status(400).json({ success: false, message: `Invalid tracking URL template for ${provider}` });
      }
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ success: false, message: 'Tracking URL templates must use HTTPS' });
      }

      const providerKey = provider.toLowerCase();
      if (normalized[providerKey]) {
        return res.status(400).json({ success: false, message: `Duplicate courier name: ${provider}` });
      }
      normalized[providerKey] = urlTemplate;
    }

    const connection = await prisma.wooCommerceConnection.update({
      where: { tenantId },
      data: { trackingUrlTemplates: normalized },
      select: { trackingUrlTemplates: true }
    });
    return res.json({ success: true, data: connection.trackingUrlTemplates });
  } catch (error) {
    console.error('Error saving WooCommerce courier tracking templates:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'WooCommerce store is not connected' });
    }
    return res.status(500).json({ success: false, message: 'Failed to save courier tracking templates' });
  }
};

export const connectWooCommerce = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { storeUrl, consumerKey, consumerSecret } = req.body;

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'storeUrl, consumerKey, and consumerSecret are required'
      });
    }

    let cleanUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const connection = await prisma.wooCommerceConnection.upsert({
      where: { tenantId },
      update: {
        storeUrl: cleanUrl,
        consumerKey,
        consumerSecret,
        status: 'CONNECTED'
      },
      create: {
        tenantId,
        storeUrl: cleanUrl,
        consumerKey,
        consumerSecret,
        status: 'CONNECTED'
      }
    });

    console.log(`✅ [WooCommerceController] Manual connection established for tenant: ${tenantId}`);

    // Auto-provision webhooks programmatically
    autoProvisionWebhooks(tenantId, cleanUrl, consumerKey, consumerSecret)
      .then(() => console.log(`🎉 [WooCommerceController] Webhooks auto-provisioned for tenant: ${tenantId}`))
      .catch(err => console.error(`⚠️ [WooCommerceController] Webhook provisioning failed:`, err.message));

    return res.json({
      success: true,
      message: 'WooCommerce connected successfully',
      data: connection
    });
  } catch (error) {
    console.error('Error connecting WooCommerce:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const disconnectWooCommerce = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;

    await prisma.wooCommerceConnection.deleteMany({
      where: { tenantId }
    });

    console.log(`🔌 [WooCommerceController] Disconnected WooCommerce for tenant: ${tenantId}`);

    return res.json({
      success: true,
      message: 'WooCommerce disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting WooCommerce:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


// ── Save Admin & Operational Alert Settings ───────────────────────────
export const updateWooCommerceAlertSettings = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const {
      alertPhone,
      newOrderAlert,
      lowStockAlert,
      lowStockThreshold,
      dailySummaryAlert,
      dailySummaryHour,
    } = req.body;

    const connection = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      return res.status(404).json({ success: false, error: 'WooCommerce store not connected.' });
    }

    const updated = await prisma.wooCommerceConnection.update({
      where: { tenantId },
      data: {
        ...(alertPhone !== undefined && { alertPhone: alertPhone ? alertPhone.trim() : null }),
        ...(newOrderAlert !== undefined && { newOrderAlert: Boolean(newOrderAlert) }),
        ...(lowStockAlert !== undefined && { lowStockAlert: Boolean(lowStockAlert) }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: parseInt(lowStockThreshold, 10) || 5 }),
        ...(dailySummaryAlert !== undefined && { dailySummaryAlert: Boolean(dailySummaryAlert) }),
        ...(dailySummaryHour !== undefined && { dailySummaryHour: parseInt(dailySummaryHour, 10) || 20 }),
      },
    });

    return res.json({
      success: true,
      message: 'Alert settings updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating WooCommerce alert settings:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
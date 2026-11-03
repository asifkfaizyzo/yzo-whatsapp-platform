// backend/src/modules/tenant/integrations/tenant.integrations.controller.js (do not remove this comment)
import prisma from '../../../config/prisma.js';
import { encrypt, decrypt } from '../../../lib/crypto.js';

export const getWhatsappCredentials = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                whatsappPhoneId: true,
                whatsappWabaId: true,
                whatsappVerifyToken: true,
                whatsappAccessToken: true,
                whatsappCatalogId: true,
            },
        });

        if (tenant && tenant.whatsappAccessToken) {
            tenant.whatsappAccessToken = decrypt(tenant.whatsappAccessToken);
        }

        return res.status(200).json({
            success: true,
            data: tenant,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateWhatsappCredentials = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const { phoneId, wabaId, accessToken, verifyToken, catalogId } = req.body;

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                whatsappPhoneId: phoneId,
                whatsappWabaId: wabaId,
                whatsappAccessToken: accessToken ? encrypt(accessToken) : undefined,
                whatsappVerifyToken: verifyToken,
                whatsappCatalogId: catalogId !== undefined ? catalogId : undefined,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'WhatsApp credentials updated successfully',
            data: updated,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const getMetaChannelsStatus = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                facebookPageId: true,
                facebookPageName: true,
                facebookPageAccessToken: true,
                instagramAccountId: true,
                instagramUsername: true,
            },
        });

        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found' });
        }

        const isFacebookConnected = Boolean(tenant.facebookPageId && tenant.facebookPageAccessToken);
        const isInstagramConnected = Boolean(tenant.instagramAccountId || tenant.instagramUsername);

        return res.status(200).json({
            success: true,
            data: {
                facebook: {
                    connected: isFacebookConnected,
                    pageId: tenant.facebookPageId || null,
                    pageName: tenant.facebookPageName || null,
                    hasToken: Boolean(tenant.facebookPageAccessToken),
                },
                instagram: {
                    connected: isInstagramConnected,
                    accountId: tenant.instagramAccountId || null,
                    username: tenant.instagramUsername || null,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const connectMetaChannels = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const {
            facebookPageId,
            facebookPageName,
            facebookPageAccessToken,
            instagramAccountId,
            instagramUsername,
        } = req.body;

        const updateData = {};
        if (facebookPageId !== undefined) updateData.facebookPageId = facebookPageId;
        if (facebookPageName !== undefined) updateData.facebookPageName = facebookPageName;
        if (facebookPageAccessToken) {
            updateData.facebookPageAccessToken = encrypt(facebookPageAccessToken);
        }
        if (instagramAccountId !== undefined) updateData.instagramAccountId = instagramAccountId;
        if (instagramUsername !== undefined) updateData.instagramUsername = instagramUsername;

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
            select: {
                facebookPageId: true,
                facebookPageName: true,
                instagramAccountId: true,
                instagramUsername: true,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Meta channels connected successfully',
            data: updated,
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const disconnectMetaChannels = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const { channel } = req.body || {};

        const updateData = {};
        if (!channel || channel === 'FACEBOOK') {
            updateData.facebookPageId = null;
            updateData.facebookPageName = null;
            updateData.facebookPageAccessToken = null;
        }
        if (!channel || channel === 'INSTAGRAM') {
            updateData.instagramAccountId = null;
            updateData.instagramUsername = null;
        }

        await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
        });

        return res.status(200).json({
            success: true,
            message: 'Meta channel(s) disconnected successfully',
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getPaymentGatewayConfig = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        razorpayAuthType: true,
        razorpayAccountId: true,
        razorpayAccountStatus: true,
        razorpayKycStatus: true,
        razorpayWebhookId: true,
        razorpayKeyId: true,
        razorpayKeySecret: true,
        razorpayWebhookSecret: true,
        enableOnlinePayment: true,
        enableCod: true,
        paymentLinkExpiryMins: true,
        defaultCurrency: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const host = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${host}/api/webhook/razorpay/order/${tenant.id}`;

    return res.status(200).json({
      success: true,
      data: {
        razorpayAuthType: tenant.razorpayAuthType || 'DIRECT_KEYS',
        razorpayAccountId: tenant.razorpayAccountId || null,
        razorpayAccountStatus: tenant.razorpayAccountStatus || 'DISCONNECTED',
        razorpayKycStatus: tenant.razorpayKycStatus || 'PENDING',
        razorpayWebhookId: tenant.razorpayWebhookId || null,
        razorpayKeyId: tenant.razorpayKeyId || '',
        hasKeySecret: Boolean(tenant.razorpayKeySecret),
        hasWebhookSecret: Boolean(tenant.razorpayWebhookSecret),
        enableOnlinePayment: Boolean(tenant.enableOnlinePayment),
        enableCod: Boolean(tenant.enableCod),
        paymentLinkExpiryMins: tenant.paymentLinkExpiryMins || 30,
        defaultCurrency: tenant.defaultCurrency || 'INR',
        webhookUrl,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePaymentGatewayConfig = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const {
      razorpayAuthType,
      razorpayKeyId,
      razorpayKeySecret,
      razorpayWebhookSecret,
      enableOnlinePayment,
      enableCod,
      paymentLinkExpiryMins,
      defaultCurrency,
    } = req.body;

    const updateData = {};
    if (razorpayAuthType !== undefined) {
      updateData.razorpayAuthType = razorpayAuthType === 'OAUTH' ? 'OAUTH' : 'DIRECT_KEYS';
    }
    if (razorpayKeyId !== undefined) updateData.razorpayKeyId = razorpayKeyId ? razorpayKeyId.trim() : null;
    if (razorpayKeySecret && razorpayKeySecret.trim() !== '') {
      updateData.razorpayKeySecret = encrypt(razorpayKeySecret.trim());
    }
    if (razorpayWebhookSecret && razorpayWebhookSecret.trim() !== '') {
      updateData.razorpayWebhookSecret = encrypt(razorpayWebhookSecret.trim());
    }
    if (enableOnlinePayment !== undefined) updateData.enableOnlinePayment = Boolean(enableOnlinePayment);
    if (enableCod !== undefined) updateData.enableCod = Boolean(enableCod);
    if (paymentLinkExpiryMins !== undefined) updateData.paymentLinkExpiryMins = Math.max(5, Math.min(1440, Number(paymentLinkExpiryMins) || 30));
    if (defaultCurrency !== undefined) updateData.defaultCurrency = defaultCurrency || 'INR';

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    const { invalidateTenantRazorpayCache } = await import('../../orders/order.payment.service.js');
    await invalidateTenantRazorpayCache(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Payment gateway settings updated successfully',
      data: {
        razorpayAuthType: updated.razorpayAuthType || 'DIRECT_KEYS',
        razorpayKeyId: updated.razorpayKeyId,
        hasKeySecret: Boolean(updated.razorpayKeySecret),
        hasWebhookSecret: Boolean(updated.razorpayWebhookSecret),
        enableOnlinePayment: updated.enableOnlinePayment,
        enableCod: updated.enableCod,
        paymentLinkExpiryMins: updated.paymentLinkExpiryMins,
        defaultCurrency: updated.defaultCurrency,
      }
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const testPaymentGatewayConnection = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { razorpayKeyId, razorpayKeySecret } = req.body;

    let keyId = razorpayKeyId;
    let secret = razorpayKeySecret;

    if (!keyId || !secret) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { razorpayKeyId: true, razorpayKeySecret: true }
      });
      if (!tenant?.razorpayKeyId || !tenant?.razorpayKeySecret) {
        return res.status(400).json({
          success: false,
          message: 'Both Key ID and Key Secret are required to test connection.'
        });
      }
      keyId = tenant.razorpayKeyId;
      secret = decrypt(tenant.razorpayKeySecret);
    }

    const Razorpay = (await import('razorpay')).default;
    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: secret,
    });

    await rzp.payments.all({ count: 1 });

    return res.status(200).json({
      success: true,
      message: 'Connection successful! Your Razorpay credentials are valid and active.'
    });

  } catch (error) {
    console.error('Razorpay test connection failed:', error.message);
    const isAuthError = error.statusCode === 401 || (error.message && error.message.toLowerCase().includes('authenticate'));
    return res.status(400).json({
      success: false,
      message: isAuthError
        ? 'Authentication failed: Invalid Razorpay Key ID or Key Secret.'
        : `Connection failed: ${error.message}`
    });
  }
};
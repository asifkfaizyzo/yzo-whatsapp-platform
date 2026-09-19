// backend/src/modules/orders/orderPaymentService.js
import Razorpay from 'razorpay';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import redisConnection from '../../config/redis.js';
import { createNotification } from '../notifications/notificationService.js';

// ── In-Memory Multi-Worker Tenant Razorpay Cache with Redis Invalidation ──
const localRazorpayCache = new Map();
const RZP_CACHE_TTL_MS = 60 * 1000; // 60-second TTL

// Redis subscriber for cross-worker cache invalidation
const rzpSubClient = redisConnection.duplicate();
rzpSubClient.subscribe('cache:invalidate:rzp', (err) => {
  if (err) console.error('❌ Failed to subscribe to cache:invalidate:rzp:', err.message);
});

rzpSubClient.on('message', (channel, tenantId) => {
  if (channel === 'cache:invalidate:rzp' && tenantId) {
    localRazorpayCache.delete(tenantId);
    console.log(`🧹 Flushed local Razorpay cache for tenant ${tenantId}`);
  }
});

/**
 * Invalidate tenant Razorpay instance across all cluster workers via Redis Pub/Sub
 */
export const invalidateTenantRazorpayCache = async (tenantId) => {
  if (!tenantId) return;
  localRazorpayCache.delete(tenantId);
  try {
    await redisConnection.publish('cache:invalidate:rzp', tenantId);
  } catch (err) {
    console.error('❌ Failed to publish cache:invalidate:rzp:', err.message);
  }
};

/**
 * Dynamically get or instantiate a tenant-scoped Razorpay client
 * Supports both 1-Click OAuth (unified X-Razorpay-Account) and Direct Manual Keys
 */
export const createTenantRazorpayInstance = async (tenantId) => {
  const cached = localRazorpayCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.instance;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      razorpayAuthType: true,
      razorpayAccountId: true,
      razorpayAccessToken: true,
      razorpayKeyId: true,
      razorpayKeySecret: true,
      enableOnlinePayment: true,
      razorpayAccountStatus: true,
    }
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  let instance;

  if (tenant.razorpayAuthType === 'OAUTH') {
    if (!tenant.razorpayAccountId) {
      throw new Error(`Razorpay sub-merchant account not connected for tenant ${tenantId}`);
    }

    if (tenant.razorpayAccessToken) {
      try {
        const decryptedToken = decrypt(tenant.razorpayAccessToken);
        instance = new Razorpay({
          oauthToken: decryptedToken,
        });
      } catch (tokenErr) {
        console.warn(`⚠️ [RazorpayOAuth] Failed to decrypt access token for tenant ${tenantId}:`, tokenErr.message);
      }
    }

    if (!instance) {
      const masterKeyId = process.env.RAZORPAY_KEY_ID;
      const masterKeySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!masterKeyId || !masterKeySecret) {
        throw new Error('Master Razorpay Partner credentials not configured on platform');
      }

      instance = new Razorpay({
        key_id: masterKeyId,
        key_secret: masterKeySecret,
        headers: {
          'X-Razorpay-Account': tenant.razorpayAccountId,
        },
      });
    }
  } else {
    // DIRECT_KEYS mode (backward compatible)
    if (!tenant.razorpayKeyId || !tenant.razorpayKeySecret) {
      throw new Error(`Razorpay credentials not configured for tenant ${tenantId}`);
    }

    const decryptedSecret = decrypt(tenant.razorpayKeySecret);
    instance = new Razorpay({
      key_id: tenant.razorpayKeyId,
      key_secret: decryptedSecret,
    });
  }

  // Attach rate limit quota monitor interceptor
  if (instance.api?.rq?.interceptors?.response) {
    instance.api.rq.interceptors.response.use(
      (response) => {
        const remaining = response.headers?.['x-rate-limit-remaining'];
        if (remaining !== undefined && Number(remaining) < 50) {
          console.warn(`⚠️ [Razorpay Rate Limit Alert] Only ${remaining} calls remaining in platform master pool!`);
        }
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  localRazorpayCache.set(tenantId, {
    instance,
    expiresAt: Date.now() + RZP_CACHE_TTL_MS,
  });

  return instance;
};

/**
 * Create a dynamic Razorpay Payment Link for a commerce order
 */
export const createOrderPaymentLink = async ({ order, tenant, contact }) => {
  try {
    const rzp = await createTenantRazorpayInstance(tenant.id);

    // Calculate integer paise
    const amountInPaise = Math.round(Number(order.totalAmount) * 100);
    const expiryMins = tenant.paymentLinkExpiryMins || 30;
    const expireByUnix = Math.floor(Date.now() / 1000) + (expiryMins * 60);

    let phoneClean = (contact.phone || '').replace(/[^0-9]/g, '');
    if (phoneClean.startsWith('91') && phoneClean.length === 12) {
      phoneClean = phoneClean.slice(2);
    }
    if (!phoneClean || phoneClean.length !== 10) {
      phoneClean = '9876543210';
    }

    const paymentLinkPayload = {
      amount: amountInPaise,
      currency: order.currency || tenant.defaultCurrency || 'INR',
      accept_partial: false,
      description: `Payment for Order #${order.orderNumber}`,
      customer: {
        name: contact.name || 'Valued Customer',
        contact: phoneClean,
      },
      notify: { sms: false, email: false }, // Delivered via WhatsApp
      reminder_enable: false,
      expire_by: expireByUnix,
      notes: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: tenant.id,
        conversationId: order.conversationId || '',
      },
    };

    const paymentLink = await rzp.paymentLink.create(paymentLinkPayload);

    // Update order with payment link metadata
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'UNPAID',
        paymentLinkUrl: paymentLink.short_url,
        paymentLinkExpiresAt: new Date(paymentLink.expire_by * 1000),
        razorpayPaymentLinkId: paymentLink.id,
        paymentAmount: order.totalAmount,
        paymentCurrency: order.currency || 'INR',
      }
    });

    console.log(`💳 Created Razorpay Payment Link (${paymentLink.id}) for Order #${order.orderNumber}: ${paymentLink.short_url}`);
    return { paymentLink, order: updatedOrder };

  } catch (error) {
    const errorDetail = error.error?.description || error.description || error.message || JSON.stringify(error);
    console.error(`❌ Payment link creation failed for Order #${order.orderNumber}:`, errorDetail, {
      statusCode: error.statusCode,
      errorResponse: error.error,
    });

    // Classification: 401 Unauthorized / Invalid Credentials / Revocation
    const isAuthError =
      error.statusCode === 401 ||
      (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('authenticate')) ||
      (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('unauthorized'));

    if (isAuthError) {
      await invalidateTenantRazorpayCache(tenant.id);
      if (tenant.razorpayAuthType === 'OAUTH') {
        // Revocation/invalid account detected: disconnect OAuth and reset account ID
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            razorpayAuthType: 'DIRECT_KEYS',
            razorpayAccountId: null,
            razorpayAccountStatus: 'DISCONNECTED',
            enableOnlinePayment: false,
          },
        });
      }

      try {
        await createNotification({
          tenantId: tenant.id,
          title: '⚠️ Razorpay Authorization Revoked / Invalid',
          message: `Failed to create payment link for Order #${order.orderNumber}. Razorpay access was revoked or invalid. Switched checkout to Cash on Delivery.`,
          type: 'SYSTEM',
        });
      } catch (notifErr) {
        console.error('Failed to create tenant notification:', notifErr.message);
      }

      // If COD is enabled, fallback automatically
      if (tenant.enableCod) {
        console.warn(`⚠️ Falling back Order #${order.orderNumber} to COD due to Razorpay authentication error`);
        const codOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: 'COD',
            paymentStatus: 'UNPAID',
            status: 'CONFIRMED',
            adminNotes: 'Fell back to COD due to Razorpay authentication failure',
          }
        });
        return { fallbackCod: true, order: codOrder };
      }
    }

    throw error;
  }
};

/**
 * Resend an existing payment link or generate a fresh one if expired
 */
export const resendOrderPaymentLink = async ({ orderId, tenantId }) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      tenant: true,
      contact: true,
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  const isExpired = order.paymentLinkExpiresAt && new Date() > new Date(order.paymentLinkExpiresAt);

  if (isExpired || !order.paymentLinkUrl) {
    console.log(`🔄 Payment link expired/missing for Order #${order.orderNumber}. Generating fresh link...`);
    return await createOrderPaymentLink({
      order,
      tenant: order.tenant,
      contact: order.contact,
    });
  }

  return {
    paymentLink: {
      id: order.razorpayPaymentLinkId,
      short_url: order.paymentLinkUrl,
      expire_by: Math.floor(new Date(order.paymentLinkExpiresAt).getTime() / 1000),
    },
    order,
    isExisting: true
  };
};

/**
 * Cancel an active Razorpay payment link
 */
export const cancelOrderPaymentLink = async ({ orderId, tenantId }) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });

  if (!order) throw new Error('Order not found');

  if (order.razorpayPaymentLinkId) {
    try {
      const rzp = await createTenantRazorpayInstance(tenantId);
      await rzp.paymentLink.cancel(order.razorpayPaymentLinkId);
      console.log(`🚫 Cancelled Razorpay Payment Link ${order.razorpayPaymentLinkId} on Razorpay`);
    } catch (err) {
      console.warn(`Warning: Could not cancel link on Razorpay (${order.razorpayPaymentLinkId}):`, err.message);
    }
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'CANCELLED',
      status: 'CANCELLED',
      adminNotes: 'Payment link cancelled by merchant/system',
    }
  });

  return updatedOrder;
};

/**
 * Initiate full or partial refund for a paid order
 */
export const initiateRefund = async (orderId, tenantId, { amount = null, reason = '' } = {}) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, paymentStatus: 'PAID' },
    include: { contact: true, tenant: true }
  });

  if (!order) {
    throw new Error('No eligible paid order found to refund');
  }

  if (!order.razorpayPaymentId) {
    throw new Error('No Razorpay payment ID found on order');
  }

  const rzp = await createTenantRazorpayInstance(tenantId);

  const refundOptions = {
    notes: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      reason: reason || 'Merchant requested refund',
    },
    receipt: `ref_${order.orderNumber}_${Date.now().toString(36)}`,
  };

  if (amount) {
    refundOptions.amount = Math.round(Number(amount) * 100); // paise
  }

  const refund = await rzp.payments.refund(order.razorpayPaymentId, refundOptions);

  const isFullRefund = !amount || Math.round(Number(amount) * 100) === Math.round(Number(order.totalAmount) * 100);

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      status: isFullRefund ? 'CANCELLED' : order.status,
      refundId: refund.id,
      refundedAt: new Date(),
      adminNotes: `Refund initiated (${refund.id}): ${reason || 'Merchant initiated'}`,
    }
  });

  console.log(`💰 Refund initiated (${refund.id}) for Order #${order.orderNumber}. Full refund: ${isFullRefund}`);
  return { refund, order: updatedOrder };
};

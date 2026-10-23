import axios from 'axios';
import prisma from '../../config/prisma.js';

/**
 * Programmatically creates order.created, order.updated, and customer.created webhooks in WooCommerce
 */
export const autoProvisionWebhooks = async (tenantId, storeUrl, consumerKey, consumerSecret) => {
  const backendUrl = process.env.BACKEND_URL || 'https://api.sudoreply.com';
  const webhookDeliveryUrl = `${backendUrl}/api2/woocommerce/webhook?tenantId=${tenantId}`;
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || 'sudoreply_wc_webhook_secret_key';

  const topics = [
    { topic: 'order.created', name: 'SudoReply Order Created Webhook' },
    { topic: 'order.updated', name: 'SudoReply Order Updated Webhook' },
    { topic: 'customer.created', name: 'SudoReply Customer Created Webhook' }
  ];

  const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const cleanStoreUrl = storeUrl.replace(/\/+$/, '');
  const webhookEndpoint = `${cleanStoreUrl}/wp-json/wc/v3/webhooks`;
  const queryRouteEndpoint = new URL(cleanStoreUrl);
  queryRouteEndpoint.searchParams.set('rest_route', '/wc/v3/webhooks');
  const requestConfig = {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  };
  const failedTopics = [];

  for (const item of topics) {
    try {
      const payload = {
        name: item.name,
        topic: item.topic,
        delivery_url: webhookDeliveryUrl,
        secret: secret,
        status: 'active'
      };

      let response;
      try {
        response = await axios.post(webhookEndpoint, payload, requestConfig);
      } catch (error) {
        if (error.response?.status !== 404) throw error;
        response = await axios.post(queryRouteEndpoint.toString(), payload, requestConfig);
      }

      console.log(`✅ [WooCommerceService] Webhook "${item.topic}" provisioned successfully (ID: ${response.data.id})`);
    } catch (error) {
      const status = error.response?.status || 'network error';
      const message = error.response?.data?.message || error.message;
      failedTopics.push(item.topic);
      console.error(`⚠️ [WooCommerceService] Webhook "${item.topic}" failed (${status}) at ${error.config?.url || webhookEndpoint}: ${message}`);
    }
  }

  if (failedTopics.length) {
    throw new Error(`WooCommerce webhook provisioning failed for: ${failedTopics.join(', ')}`);
  }
};

/**
 * Updates an order status in WooCommerce and optionally adds a note.
 */
export const updateWooCommerceOrderStatus = async (tenantId, orderId, newStatus, note = '') => {
  try {
    // 1. Get store credentials
    const connection = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId }
    });

    if (!connection || connection.status !== 'CONNECTED') {
      throw new Error('WooCommerce store is not connected');
    }

    const { storeUrl, consumerKey, consumerSecret } = connection;
    const cleanStoreUrl = storeUrl.replace(/\/+$/, '');
    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    // 2. Update the Order Status
    const orderEndpoint = `${cleanStoreUrl}/wp-json/wc/v3/orders/${orderId}`;
    await axios.put(
      orderEndpoint,
      { status: newStatus },
      { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } }
    );

    // 3. Add an Order Note (Optional but highly recommended for the store admin)
    if (note) {
      const noteEndpoint = `${cleanStoreUrl}/wp-json/wc/v3/orders/${orderId}/notes`;
      await axios.post(
        noteEndpoint,
        { note: note, customer_note: false },
        { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [WooCommerceService] Order #${orderId} updated to '${newStatus}' for tenant ${tenantId}`);
    return true;

  } catch (error) {
    console.error(`❌ [WooCommerceService] Failed to update order #${orderId}:`, error.response?.data || error.message);
    return false;
  }
};
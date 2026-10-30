// src/modules/shopify/shopifyOrderLookupService.js

import axios from 'axios'
import prisma from '../../config/prisma.js'
import { decrypt } from '../../lib/crypto.js'
import { generateTrackingUrl } from '../../utils/trackingHelper.js'

const normalizeShopifyApiOrder = (shopifyOrder) => {
  const fulfillments = Array.isArray(shopifyOrder.fulfillments)
    ? shopifyOrder.fulfillments
    : []
  const trackingInfo = fulfillments.flatMap((fulfillment) => {
    const trackingNumbers = Array.isArray(fulfillment.tracking_numbers)
      ? fulfillment.tracking_numbers
      : fulfillment.tracking_number
        ? [fulfillment.tracking_number]
        : []
    const trackingUrls = Array.isArray(fulfillment.tracking_urls)
      ? fulfillment.tracking_urls
      : fulfillment.tracking_url
        ? [fulfillment.tracking_url]
        : []

    return trackingNumbers.map((number, index) => {
      const provider = fulfillment.tracking_company || 'Unknown'
      const url = trackingUrls[index] || trackingUrls[0] || ''
      return {
        provider,
        number,
        url: url || generateTrackingUrl(provider, number),
      }
    })
  })

  const customer = shopifyOrder.customer || {}

  return {
    orderNumber: shopifyOrder.name || `#${shopifyOrder.order_number}`,
    status: shopifyOrder.cancelled_at
      ? 'cancelled'
      : shopifyOrder.fulfillment_status === 'fulfilled'
        ? 'completed'
        : 'processing',
    paymentStatus: String(shopifyOrder.financial_status || 'pending').toUpperCase(),
    currency: shopifyOrder.currency || 'INR',
    total: Number(shopifyOrder.current_total_price || shopifyOrder.total_price || 0),
    customerName: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer',
    createdAt: shopifyOrder.created_at,
    lineItems: (shopifyOrder.line_items || []).map((item) => {
      const quantity = Number(item.quantity) || 1
      const price = Number(item.price) || 0
      return {
        name: item.title || item.name || 'Item',
        quantity,
        price,
        total: (price * quantity).toFixed(2),
      }
    }),
    trackingInfo,
  }
}

const shopifyOrderLookupService = {

  // ─────────────────────────────────────────
  // Find a tenant's Shopify order by number, or latest by phone when no number is given
  // ─────────────────────────────────────────
  findOrder: async (tenantId, phone, orderNumber = null) => {
    try {
      console.log(`🔎 SHOPIFY LOOKUP -> Tenant: "${tenantId}", Phone: "${phone}", Query: "${orderNumber}"`);

      if (!tenantId) {
        console.error('❌ shopifyOrderLookupService.findOrder requires a tenantId')
        return null
      }

      const cleanNum = orderNumber
        ? String(orderNumber).trim().replace(/^#+\s*/, '').trim()
        : ''

      // Do not fall back to another order by phone when a specific order number was provided.
      if (cleanNum) {
        const searchVariants = [cleanNum, `#${cleanNum}`];
        const order = await prisma.ecommerceOrder.findFirst({
          where: {
            tenantId,
            source: 'SHOPIFY',
            orderNumber: { in: searchVariants },
          },
          orderBy: { createdAt: 'desc' }
        });

        if (order) {
          console.log(`✅ FOUND BY ORDER NUMBER: #${cleanNum}`);
          return order;
        }

        const connection = await prisma.shopifyConnection.findFirst({
          where: { tenantId, status: 'active' },
          select: { shopName: true, accessToken: true },
        })

        if (connection) {
          const shopName = String(connection.shopName || '').trim().toLowerCase()
          if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopName)) {
            console.error(`❌ Invalid Shopify shop domain configured for tenant ${tenantId}`)
            return null
          }

          const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07'
          const accessToken = decrypt(connection.accessToken)
          const response = await axios.get(
            `https://${shopName}/admin/api/${apiVersion}/orders.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken },
              params: { status: 'any', name: `#${cleanNum}`, limit: 250 },
              timeout: 10000,
            }
          )
          const matchedOrder = (response.data?.orders || []).find((shopifyOrder) => {
            const apiOrderNumber = String(shopifyOrder.order_number || '').trim()
            const apiName = String(shopifyOrder.name || '').replace(/^#+\s*/, '').trim()
            return apiOrderNumber === cleanNum || apiName === cleanNum
          })

          if (matchedOrder) {
            console.log(`✅ FOUND BY SHOPIFY API: #${cleanNum}`)
            return normalizeShopifyApiOrder(matchedOrder)
          }
        } else {
          console.warn(`⚠️ No active Shopify connection for tenant ${tenantId}`)
        }

        console.log(`⚠️ Shopify order #${cleanNum} was not found for tenant ${tenantId}`)
        return null
      }

      // When no order number was provided, find the latest Shopify order for this phone.
      if (phone) {
        const normalizedPhone = String(phone).replace(/\D/g, '');
        const nationalDigits = normalizedPhone.length > 10 ? normalizedPhone.slice(-10) : normalizedPhone;

        if (nationalDigits) {
          const phoneOrder = await prisma.ecommerceOrder.findFirst({
            where: {
              tenantId,
              source: 'SHOPIFY',
              customerPhone: { contains: nationalDigits }
            },
            orderBy: { createdAt: 'desc' }
          });

          if (phoneOrder) {
            console.log(`✅ FOUND BY PHONE NUMBER: ${phoneOrder.orderNumber}`);
            return phoneOrder;
          }

          const connection = await prisma.shopifyConnection.findFirst({
            where: { tenantId, status: 'active' },
            select: { shopName: true, accessToken: true },
          })

          if (connection) {
            const shopName = String(connection.shopName || '').trim().toLowerCase()
            if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopName)) {
              console.error(`❌ Invalid Shopify shop domain configured for tenant ${tenantId}`)
              return null
            }

            const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07'
            const accessToken = decrypt(connection.accessToken)
            const response = await axios.get(
              `https://${shopName}/admin/api/${apiVersion}/orders.json`,
              {
                headers: { 'X-Shopify-Access-Token': accessToken },
                params: { status: 'any', limit: 250 },
                timeout: 10000,
              }
            )
            const matchedOrder = (response.data?.orders || []).find((shopifyOrder) => {
              const customer = shopifyOrder.customer || {}
              const candidatePhones = [
                customer.phone,
                shopifyOrder.phone,
                shopifyOrder.billing_address?.phone,
                shopifyOrder.shipping_address?.phone,
              ]
              return candidatePhones.some((candidate) => {
                const candidateDigits = String(candidate || '').replace(/\D/g, '')
                return candidateDigits.endsWith(nationalDigits)
              })
            })

            if (matchedOrder) {
              console.log(`✅ FOUND BY SHOPIFY API PHONE LOOKUP for tenant ${tenantId}`)
              return normalizeShopifyApiOrder(matchedOrder)
            }
          } else {
            console.warn(`⚠️ No active Shopify connection for tenant ${tenantId}`)
          }
        }
      }

      console.log(`⚠️ Order lookup returned no results for Query: "${orderNumber}", Phone: "${phone}"`);
      return null;
    } catch (error) {
      console.error('❌ shopifyOrderLookupService.findOrder error:', error);
      return null;
    }
  },

  // ─────────────────────────────────────────
  // Format tracking info from order JSON
  // ─────────────────────────────────────────
  formatTrackingInfo: (order) => {
    let trackingInfo = order?.trackingInfo || []

    if (typeof trackingInfo === 'string') {
      try {
        trackingInfo = JSON.parse(trackingInfo)
      } catch {
        trackingInfo = []
      }
    }

    if (!Array.isArray(trackingInfo) && trackingInfo && typeof trackingInfo === 'object') {
      trackingInfo = [trackingInfo]
    }

    if (!Array.isArray(trackingInfo) || trackingInfo.length === 0) {
      return {
        hasTracking: false,
        trackingNumber: 'Not available yet',
        trackingUrl: 'Not available yet',
        trackingProvider: 'Unknown',
        allTracking: []
      }
    }

    const first = trackingInfo[0] || {}
    const provider = first.provider || first.carrier || 'Unknown'
    const number = first.number || first.trackingNumber || ''
    const url = first.url || generateTrackingUrl(provider, number)
    const hasTracking = Boolean(number || url)

    return {
      hasTracking,
      trackingNumber: number || 'Not available yet',
      trackingUrl: url || 'Not available yet',
      trackingProvider: provider,
      allTracking: trackingInfo.map(item => ({
        provider: item?.provider || item?.carrier || 'Unknown',
        number: item?.number || item?.trackingNumber || '',
        url: item?.url || generateTrackingUrl(item?.provider || item?.carrier, item?.number || item?.trackingNumber)
      }))
    }
  },

  // ─────────────────────────────────────────
  // Format order status with emojis
  // ─────────────────────────────────────────
  formatOrderStatus: (order) => {
    if (!order) return null

    const statusMap = {
      'PENDING': '⏳ Pending',
      'CONFIRMED': '✅ Confirmed',
      'PROCESSING': '🔄 Processing',
      'COMPLETED': '✅ Fulfilled',
      'SHIPPED': '🚚 Shipped',
      'OUT_FOR_DELIVERY': '📦 Out for Delivery',
      'DELIVERED': '✅ Delivered',
      'CANCELLED': '❌ Cancelled',
      'REFUNDED': '💰 Refunded',
      'FULFILLED': '✅ Fulfilled',
      'UNFULFILLED': '⏳ Unfulfilled',
      'PARTIALLY_FULFILLED': '📦 Partially Fulfilled',
    }

    const paymentMap = {
      'PAID': '✅ Paid',
      'UNPAID': '⏳ Unpaid',
      'PENDING': '⏳ Pending',
      'CANCELLED': '❌ Cancelled',
      'REFUNDED': '💰 Refunded',
      'PARTIALLY_REFUNDED': '💰 Partially Refunded',
    }

    const rawStatus = order.status || 'Unknown'
    const rawPaymentStatus = order.paymentStatus || 'Unknown'

    return {
      status: statusMap[String(rawStatus).toUpperCase()] || rawStatus,
      rawStatus,
      paymentStatus: paymentMap[String(rawPaymentStatus).toUpperCase()] || rawPaymentStatus,
      rawPaymentStatus,
      orderDate: order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
          })
        : 'N/A',
      orderNumber: order.orderNumber
        ? String(order.orderNumber).replace(/^#+\s*/, '').trim()
        : 'N/A',
    }
  },

  // ─────────────────────────────────────────
  // Format line items and total from EcommerceOrder fields
  // ─────────────────────────────────────────
  formatOrderDetails: (order) => {
    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : []
    const itemsSummary = lineItems.length > 0
      ? lineItems.map((item, index) => {
          const name = item?.name || item?.title || `Item ${index + 1}`
          const quantity = Number(item?.quantity) || 1
          const price = Number(item?.price ?? item?.unitPrice ?? 0)
          return `  • ${name} × ${quantity} — ${order.currency || 'INR'} ${price.toFixed(2)}`
        }).join('\n')
      : '  No items found'

    const calculatedTotal = lineItems.reduce((sum, item) => {
      const itemTotal = Number(item?.total)
      const unitPrice = Number(item?.price ?? item?.unitPrice ?? 0)
      const quantity = Number(item?.quantity) || 1
      return sum + (Number.isFinite(itemTotal) ? itemTotal : unitPrice * quantity)
    }, 0)
    const storedTotal = Number(order?.total)
    const totalAmount = Number.isFinite(storedTotal) ? storedTotal : calculatedTotal

    return {
      itemsSummary,
      totalAmount: totalAmount.toFixed(2),
      currency: order?.currency || 'INR',
      itemCount: lineItems.length,
      customerName: order?.customerName || 'Customer',
    }
  },

  /**
   * Generates variables for flowData supporting BOTH snake_case and camelCase
   */
  buildFlowData(order) {
    if (!order) {
      return {
        lookupFound: false,
        order_number: 'N/A',
        order_status: '❌ Order Not Found',
        order_status_raw: 'Not Found',
        payment_status: 'N/A',
        payment_status_raw: 'N/A',
        order_date: 'N/A',
        tracking_number: 'N/A',
        tracking_url: 'N/A',
        tracking_provider: 'N/A',
        has_tracking: 'no',
        items_summary: 'N/A',
        total_amount: 'N/A',
        currency: 'N/A',
        item_count: '0',
        customer_name: 'N/A',
        orderNumber: 'N/A',
        orderStatus: '❌ Order Not Found',
        paymentStatus: 'N/A',
        trackingNumber: 'N/A',
        trackingUrl: 'N/A',
        trackingProvider: 'N/A',
        itemsSummary: 'N/A',
        totalAmount: 'N/A',
        itemCount: 0,
        customerName: 'N/A',
      }
    }

    const tracking = shopifyOrderLookupService.formatTrackingInfo(order)
    const status = shopifyOrderLookupService.formatOrderStatus(order)
    const details = shopifyOrderLookupService.formatOrderDetails(order)

    return {
      order_number: status.orderNumber,
      order_status: status.status,
      order_status_raw: status.rawStatus,
      payment_status: status.paymentStatus,
      payment_status_raw: status.rawPaymentStatus,
      order_date: status.orderDate,
      tracking_number: tracking.trackingNumber,
      tracking_url: tracking.trackingUrl,
      tracking_provider: tracking.trackingProvider,
      has_tracking: tracking.hasTracking ? 'yes' : 'no',
      items_summary: details.itemsSummary,
      total_amount: details.totalAmount,
      currency: details.currency,
      item_count: String(details.itemCount),
      customer_name: details.customerName,

      orderNumber: status.orderNumber,
      orderStatus: status.status,
      paymentStatus: status.paymentStatus,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
      trackingProvider: tracking.trackingProvider,
      itemsSummary: details.itemsSummary,
      totalAmount: details.totalAmount,
      itemCount: details.itemCount,
      customerName: details.customerName,
    };
  }
};

export default shopifyOrderLookupService;
import axios from 'axios';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';

/**
 * Resolves Shopify customers to SudoReply Contacts based on targeting rules.
 * Mirrors wooBroadcastSegmentService.js pattern exactly.
 *
 * Primary: Fetches customers from Shopify REST API (with tag filtering).
 * Fallback: Uses local EcommerceOrder table if Shopify API fails.
 */
export async function resolveShopifySegment(tenantId, filters = {}) {
  const {
    shopifyCustomerTags = null,
    segmentMinSpend = null,
    segmentMinOrders = null,
    segmentInactiveDays = null,
  } = filters;

  // 1. Get Shopify connection credentials
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });

  if (!connection || connection.status !== 'active') {
    console.warn(`📢 [Shopify Segment] No active Shopify connection for tenant=${tenantId}`);
    return { contacts: [], stats: { matched: 0, reason: 'no_connection' } };
  }

  const shopName = connection.shopName;
  const accessToken = decrypt(connection.accessToken);
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';

  // 2. Fetch ALL customers from Shopify REST API (paginated)
  let allCustomers = [];
  let pageInfo = null;

  try {
    while (true) {
      const params = { limit: 250 };

      if (pageInfo) {
        params.page_info = pageInfo;
      }

      let url;
      if (shopifyCustomerTags && shopifyCustomerTags.length > 0 && !pageInfo) {
        const tagQuery = shopifyCustomerTags.map(t => `tag:${t}`).join(' OR ');
        url = `https://${shopName}/admin/api/${apiVersion}/customers/search.json`;
        params.query = tagQuery;
      } else {
        url = `https://${shopName}/admin/api/${apiVersion}/customers.json`;
      }

      const res = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        params,
        timeout: 15000,
      });

      const customers = res.data?.customers || [];
      if (customers.length === 0) break;

      allCustomers = allCustomers.concat(customers);

      // Cursor-based pagination via Link header
      const linkHeader = res.headers?.link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^&>]+)/);
        if (match) {
          pageInfo = match[1];
        } else {
          break;
        }
      } else {
        break;
      }

      // Safety cap: 2500 customers max
      if (allCustomers.length >= 2500) {
        console.warn(`📢 [Shopify Segment] Hit 2500 customer cap for tenant=${tenantId}`);
        break;
      }
    }
  } catch (err) {
    console.error(`📢 [Shopify Segment] API error for tenant=${tenantId}:`, err.message);
    return resolveShopifySegmentFromOrders(tenantId, filters);
  }

  if (allCustomers.length === 0) {
    console.log(`📢 [Shopify Segment] 0 customers from Shopify API, falling back to orders`);
    return resolveShopifySegmentFromOrders(tenantId, filters);
  }

  // 3. Normalize Shopify customers
  let customers = allCustomers
    .map(c => {
      const rawPhone = c.phone || c.default_address?.phone || '';
      const phone = rawPhone.replace(/[^\d+]/g, '');
      if (!phone || phone.length < 8) return null;

      const cleanPhone = phone.startsWith('+') ? phone : `+${phone}`;
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Shopify Customer';

      return {
        phone: cleanPhone,
        name,
        email: c.email || null,
        totalSpent: parseFloat(c.total_spent) || 0,
        ordersCount: c.orders_count || 0,
      };
    })
    .filter(Boolean);

  // 4. Apply order-history filters
  if (segmentMinSpend != null && !isNaN(Number(segmentMinSpend))) {
    customers = customers.filter(c => c.totalSpent >= Number(segmentMinSpend));
  }
  if (segmentMinOrders != null && !isNaN(Number(segmentMinOrders))) {
    customers = customers.filter(c => c.ordersCount >= Number(segmentMinOrders));
  }

  const matchedPhones = customers.map(c => c.phone);

  if (matchedPhones.length === 0) {
    console.log(`📢 [Shopify Segment] tenant=${tenantId} matched 0 customers after filters`);
    return { contacts: [], stats: { matched: 0 } };
  }

  // 5. Match with existing Contacts or Auto-Create missing ones
  return matchAndCreateContacts(tenantId, customers, matchedPhones, 'shopifyCustomerTags');
}

/**
 * Fallback: Resolve from EcommerceOrder table (same pattern as WooCommerce)
 */
async function resolveShopifySegmentFromOrders(tenantId, filters = {}) {
  const {
    segmentMinSpend = null,
    segmentMinOrders = null,
    segmentInactiveDays = null,
  } = filters;

  const countedStatuses = [
    'processing', 'completed', 'shipped',
    'fulfilled', 'paid', 'delivered',
  ];

  const orders = await prisma.ecommerceOrder.findMany({
    where: {
      tenantId,
      source: 'SHOPIFY',
      status: { in: countedStatuses },
    },
    select: {
      customerPhone: true,
      customerName: true,
      total: true,
      createdAt: true,
    },
  });

  const byPhone = new Map();
  for (const o of orders) {
    const phone = String(o.customerPhone).replace(/\D/g, '');
    if (!phone) continue;

    const amount = parseFloat(o.total) || 0;
    const prev = byPhone.get(phone) || {
      phone: phone.startsWith('+') ? phone : `+${phone}`,
      name: o.customerName || null,
      totalSpend: 0,
      orderCount: 0,
      lastOrderAt: null,
    };

    prev.totalSpend += amount;
    prev.orderCount += 1;
    if (!prev.lastOrderAt || o.createdAt > prev.lastOrderAt) {
      prev.lastOrderAt = o.createdAt;
      if (o.customerName) prev.name = o.customerName;
    }
    byPhone.set(phone, prev);
  }

  const now = Date.now();
  let customers = [...byPhone.values()];

  if (segmentMinSpend != null && !isNaN(Number(segmentMinSpend))) {
    customers = customers.filter(c => c.totalSpend >= Number(segmentMinSpend));
  }
  if (segmentMinOrders != null && !isNaN(Number(segmentMinOrders))) {
    customers = customers.filter(c => c.orderCount >= Number(segmentMinOrders));
  }
  if (segmentInactiveDays != null && !isNaN(Number(segmentInactiveDays))) {
    const cutoff = now - Number(segmentInactiveDays) * 24 * 60 * 60 * 1000;
    customers = customers.filter(c => c.lastOrderAt && c.lastOrderAt.getTime() <= cutoff);
  }

  const matchedPhones = customers.map(c => c.phone);

  if (matchedPhones.length === 0) {
    return { contacts: [], stats: { matched: 0 } };
  }

  return matchAndCreateContacts(tenantId, customers, matchedPhones, 'ecommerce_orders');
}

/**
 * Shared helper: Match phones to existing contacts, auto-create missing ones
 */
async function matchAndCreateContacts(tenantId, customers, matchedPhones, source) {
  const existingContacts = await prisma.contact.findMany({
    where: { tenantId, phone: { in: matchedPhones } },
  });

  const existingMap = new Map(existingContacts.map(c => [c.phone, c]));
  const finalContacts = [];

  for (const cust of customers) {
    if (existingMap.has(cust.phone)) {
      finalContacts.push(existingMap.get(cust.phone));
    } else {
      try {
        const created = await prisma.contact.create({
          data: {
            tenantId,
            phone: cust.phone,
            name: cust.name || 'Shopify Customer',
            email: cust.email || null,
            isActive: true,
          },
        });
        finalContacts.push(created);
      } catch (err) {
        console.warn(`📢 [Shopify Segment] Contact creation failed for ${cust.phone}:`, err.message);
      }
    }
  }

  console.log(`📢 [Shopify Segment] Resolved ${finalContacts.length} contacts for tenant=${tenantId} (source: ${source})`);

  return {
    contacts: finalContacts,
    stats: {
      matched: finalContacts.length,
      source,
    },
  };
}
import prisma from '../../config/prisma.js';

/**
 * Resolves WooCommerce orders to SudoReply Contacts based on targeting rules.
 * Supports: Total Spend, Order Count, Inactivity (Days), or All Woo Customers.
 */
export async function resolveWooCommerceSegment(tenantId, filters = {}) {
  const {
    segmentMinSpend = null,
    segmentMinOrders = null,
    segmentInactiveDays = null,
    segmentIncludeAllWoo = false,
  } = filters;

  // Paid/completed-style order statuses
  const countedStatuses = [
    'processing',
    'completed',
    'shipped',
    'wc-processing',
    'wc-completed',
    'delivered',
  ];

    // 1. Fetch all orders for this tenant
  const orders = await prisma.ecommerceOrder.findMany({
    where: {
      tenantId,
      status: { in: countedStatuses },
    },
    select: {
      customerPhone: true,
      customerName: true,
      total: true,
      createdAt: true,
    },
  });

  // 2. Aggregate metrics per cleaned phone number
  const byPhone = new Map();
  for (const o of orders) {
    const phone = String(o.customerPhone).replace(/\D/g, '');
    if (!phone) continue;

    const amount = parseFloat(o.total) || 0;
    const prev = byPhone.get(phone) || {
      phone,
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

  // 3. Apply Segmentation Filters
  if (segmentMinSpend != null && !isNaN(Number(segmentMinSpend))) {
    customers = customers.filter((c) => c.totalSpend >= Number(segmentMinSpend));
  }
  if (segmentMinOrders != null && !isNaN(Number(segmentMinOrders))) {
    customers = customers.filter((c) => c.orderCount >= Number(segmentMinOrders));
  }
  if (segmentInactiveDays != null && !isNaN(Number(segmentInactiveDays))) {
    const cutoff = now - Number(segmentInactiveDays) * 24 * 60 * 60 * 1000;
    customers = customers.filter(
      (c) => c.lastOrderAt && c.lastOrderAt.getTime() <= cutoff
    );
  }

  const matchedPhones = customers.map((c) => c.phone);

  if (matchedPhones.length === 0) {
    console.log(`📢 [Woo Segment] tenant=${tenantId} matched 0 customers`);
    return { contacts: [], stats: { matched: 0 } };
  }

  // 4. Match with existing Contacts or Auto-Create missing ones
  const existingContacts = await prisma.contact.findMany({
    where: { tenantId, phone: { in: matchedPhones } },
  });

  const existingMap = new Map(existingContacts.map((c) => [c.phone, c]));
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
            name: cust.name || 'WooCommerce Customer',
            isActive: true,
          },
        });
        finalContacts.push(created);
      } catch (err) {
        console.warn(`📢 [Woo Segment] Contact creation failed for ${cust.phone}:`, err.message);
      }
    }
  }

  console.log(`📢 [Woo Segment] Resolved ${finalContacts.length} contacts for tenant=${tenantId}`);

  return {
    contacts: finalContacts,
    stats: {
      matched: finalContacts.length,
      segmentMinSpend,
      segmentMinOrders,
      segmentInactiveDays,
      segmentIncludeAllWoo,
    },
  };
}
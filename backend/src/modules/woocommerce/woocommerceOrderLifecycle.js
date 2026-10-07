export const getWooPaymentStatus = (payload) => {
  const status = String(payload.status || '').toLowerCase();
  const paymentMethod = String(
    payload.payment_method_title || payload.payment_method || '',
  ).toLowerCase();

  if (
    String(payload.payment_method || '').toLowerCase() === 'cod' ||
    paymentMethod.includes('cash on delivery')
  ) {
    return 'PENDING';
  }
  if (status === 'failed') return 'FAILED';
  if (status === 'refunded' || status === 'partially-refunded') return 'REFUNDED';
  if (payload.date_paid || payload.date_paid_gmt) return 'PAID';
  return 'PENDING';
};

const getTrackingUrlFallback = (provider, number, trackingUrlTemplates) => {
  const template = Object.entries(trackingUrlTemplates || {}).find(
    ([courier]) => courier.trim().toLowerCase() === String(provider || '').trim().toLowerCase(),
  )?.[1];
  if (!template || !number) return '';
  return String(template).replace(/\{\{tracking_number\}\}/g, encodeURIComponent(String(number)));
};

export const extractWooTrackingInfo = (payload, trackingUrlTemplates = {}) => {
  const metaData = Array.isArray(payload.meta_data) ? payload.meta_data : [];
  const trackingMeta = metaData.filter(({ key }) => /tracking/i.test(key || ''));
  const trackingItems = trackingMeta
    .filter(({ key }) => /tracking_items|shipment_tracking/i.test(key || ''))
    .map(({ value }) => value);
  const metaFields = Object.fromEntries(
    trackingMeta.map(({ key, value }) => [String(key).replace(/^_+/, '').toLowerCase(), value]),
  );
  const directFields = {
    tracking_provider: payload.tracking_provider || metaFields.tracking_provider || metaFields.shipping_provider,
    tracking_number: payload.tracking_number || metaFields.tracking_number,
    tracking_link: payload.tracking_link
      || payload.tracking_url
      || payload.custom_tracking_link
      || metaFields.tracking_link
      || metaFields.tracking_url
      || metaFields.custom_tracking_link,
  };
  if (Object.values(directFields).some(Boolean)) trackingItems.push(directFields);

  const candidates = [payload.tracking_items, payload.shipment_tracking_items, ...trackingItems];
  const normalized = candidates.flatMap((candidate) => {
    let parsed = candidate;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }

    const entries = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : [];

    return entries.flatMap((entry) => {
      const nestedItems = entry.tracking_items || entry.items;
      const items = Array.isArray(nestedItems) ? nestedItems : [entry];
      return items
        .map((item) => ({
          provider: item.tracking_provider || item.provider || item.courier || item.carrier || '',
          number: item.tracking_number || item.trackingNumber || item.number || '',
          url: item.tracking_link
            || item.tracking_url
            || item.trackingLink
            || item.url
            || item.custom_tracking_link
            || getTrackingUrlFallback(
              item.tracking_provider || item.provider || item.courier || item.carrier,
              item.tracking_number || item.trackingNumber || item.number,
              trackingUrlTemplates,
            ),
          dateShipped: item.date_shipped || item.dateShipped || '',
        }))
        .filter((item) => item.number || item.url);
    });
  });

  const uniqueTracking = normalized.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.number === item.number && candidate.url === item.url) === index,
  );
  return uniqueTracking.length ? uniqueTracking : null;
};

export const findWooShipmentTemplate = (templates) => {
  const shipmentTemplates = (templates || []).filter((template) => {
    if (template.status !== 'APPROVED' || !/(ship|shipment|tracking)/i.test(template.name || '')) {
      return false;
    }

    const body = Array.isArray(template.components)
      ? template.components.find((component) => String(component.type).toUpperCase() === 'BODY')
      : null;
    const placeholders = [...new Set((body?.text || '').match(/\{\{\d+\}\}/g) || [])];
    return placeholders.length === 4
      && [1, 2, 3, 4].every((index) => placeholders.includes(`{{${index}}}`));
  });

  return shipmentTemplates.sort((a, b) =>
    Number(b.name === 'order_shipped') - Number(a.name === 'order_shipped'),
  )[0] || null;
};

export const buildWooShipmentTemplateParameters = ({ customerName, orderNumber, trackingInfo }) => {
  const shipments = (trackingInfo || []).filter((item) => item.provider && item.url);
  if (!shipments.length) return null;

  return [
    customerName || 'Customer',
    String(orderNumber || ''),
    shipments.map((item) => item.provider).join(', '),
    shipments.map((item) => item.url).join('\n'),
  ];
};

export const findWooCustomerWelcomeTemplate = (templates) => {
  const candidates = (templates || []).filter((template) => {
    if (template.status !== 'APPROVED' || !/welcome/i.test(template.name || '')) return false;
    if (!Array.isArray(template.components)) return false;

    const body = template.components.find(
      (component) => String(component.type).toUpperCase() === 'BODY',
    );
    if (!body?.text) return false;

    const placeholders = [...new Set(body.text.match(/\{\{(\d+)\}\}/g) || [])]
      .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
    const hasDynamicNonBodyComponent = template.components.some((component) =>
      String(component.type).toUpperCase() !== 'BODY'
      && /\{\{\d+\}\}/.test(component.text || ''),
    );
    return !hasDynamicNonBodyComponent
      && placeholders.length <= 2
      && placeholders.every((placeholder, index) => placeholder === `{{${index + 1}}}`);
  });

  return candidates.sort((a, b) =>
    Number(b.name === 'customer_welcome') - Number(a.name === 'customer_welcome'),
  )[0] || null;
};

export const buildWooCustomerWelcomeTemplateParameters = ({ template, customerName, storeName }) => {
  const body = template?.components?.find(
    (component) => String(component.type).toUpperCase() === 'BODY',
  );
  const placeholders = [...new Set((body?.text || '').match(/\{\{\d+\}\}/g) || [])]
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));

  return placeholders.map((placeholder) =>
    Number(placeholder.match(/\d+/)[0]) === 1 ? customerName : storeName,
  );
};

export const buildWooCustomerWelcomeMessage = ({ customerName, storeName }) =>
  `👋 Welcome to *${storeName}*, *${customerName}*! We're glad you're here.`;

const formatStatus = (status) =>
  String(status || 'pending')
    .toLowerCase()
    .replace(/^wc-/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const buildWooOrderLifecycleMessage = ({
  isNewOrder,
  previousStatus,
  status,
  previousPaymentStatus,
  paymentStatus,
  paymentMethod,
  customerName,
  orderNumber,
  currency,
  total,
  lineItems,
  hasTrackingChanged,
  trackingInfo,
}) => {
  if (isNewOrder) {
    return `🎉 *Order Confirmation!*\n\nHi *${customerName}*,\nYour order *#${orderNumber}* has been received!\n\n📦 *Items:* ${lineItems || 'WooCommerce Items'}\n💰 *Total:* ${currency} ${total}\n💳 *Payment method:* ${paymentMethod}\n💳 *Payment status:* ${formatStatus(paymentStatus)}`;
  }

  const changes = [];
  if (previousStatus && previousStatus !== String(status).toLowerCase()) {
    changes.push(`Order status: *${formatStatus(previousStatus)}* → *${formatStatus(status)}*`);
  } else if (!previousStatus && status) {
    changes.push(`Order status: *${formatStatus(status)}*`);
  }
  if (previousPaymentStatus && previousPaymentStatus !== String(paymentStatus).toLowerCase()) {
    changes.push(`Payment status: *${formatStatus(previousPaymentStatus)}* → *${formatStatus(paymentStatus)}*`);
  }

  const normalizedStatus = String(status || '').toLowerCase().replace(/^wc-/, '');
  const normalizedPreviousStatus = String(previousStatus || '').toLowerCase().replace(/^wc-/, '');
  const isShippingMilestone = ['shipped', 'delivered', 'completed'].includes(normalizedStatus);
  const isStatusTransition = normalizedPreviousStatus !== normalizedStatus;
  const trackingDetails = (trackingInfo || [])
    .map((item) => [
      item.provider,
      item.number && `Tracking number: ${item.number}`,
      item.url && `Tracking link: ${item.url}`,
    ].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
  if ((hasTrackingChanged || (isStatusTransition && isShippingMilestone)) && trackingDetails) {
    changes.push(`Shipping tracking:\n${trackingDetails}`);
  }
  if (!changes.length) return null;

  const statusCopy = {
    processing: 'Your order is being packed.',
    shipped: trackingDetails
      ? 'Your order has shipped. Use the tracking details above to follow its progress.'
      : 'Your order has shipped. Tracking details will be shared when available.',
    delivered: 'Your order has been delivered. Please reply with a rating from 1 to 5.',
    completed: 'Your order is complete. Please reply with a rating from 1 to 5.',
    cancelled: 'Your order has been cancelled.',
    refunded: 'Your order has been refunded. Refund timing depends on your payment provider.',
    'on-hold': 'Your order is on hold.',
    failed: 'Your payment failed. Please contact the store for help completing your order.',
  };

  return `📦 *Order Update*\n\nHi *${customerName}*, order *#${orderNumber}* was updated.\n${changes.join('\n')}\n\n${statusCopy[normalizedStatus] || 'We will keep you updated.'}`;
};

export const parseWooReviewRating = (text) => {
  const match = String(text || '').trim().match(/^([1-5])(?:\s*(?:\/\s*5|stars?))?$/i);
  return match ? Number(match[1]) : null;
};
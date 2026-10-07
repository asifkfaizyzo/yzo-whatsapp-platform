import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWooCustomerWelcomeMessage,
  buildWooCustomerWelcomeTemplateParameters,
  buildWooShipmentTemplateParameters,
  buildWooOrderLifecycleMessage,
  extractWooTrackingInfo,
  findWooCustomerWelcomeTemplate,
  findWooShipmentTemplate,
  getWooPaymentStatus,
  parseWooReviewRating,
} from './woocommerceOrderLifecycle.js';

test('COD stays pending even if WooCommerce provides a paid timestamp', () => {
  assert.equal(
    getWooPaymentStatus({ payment_method: 'cod', status: 'processing', date_paid: '2026-10-05T10:00:00' }),
    'PENDING',
  );
});

test('Razorpay payment state follows WooCommerce payment data', () => {
  assert.equal(getWooPaymentStatus({ payment_method: 'razorpay', status: 'processing' }), 'PENDING');
  assert.equal(getWooPaymentStatus({ payment_method: 'razorpay', status: 'processing', date_paid: '2026-10-05T10:00:00' }), 'PAID');
  assert.equal(getWooPaymentStatus({ payment_method: 'razorpay', status: 'failed', date_paid: null }), 'FAILED');
  assert.equal(getWooPaymentStatus({ payment_method: 'razorpay', status: 'refunded' }), 'REFUNDED');
});

test('extracts and deduplicates shipment tracking metadata', () => {
  const trackingInfo = extractWooTrackingInfo({
    meta_data: [{
      key: '_wc_shipment_tracking_items',
      value: [{ tracking_provider: 'Blue Dart', tracking_number: 'BD123', tracking_link: 'https://track.example/BD123' }],
    }],
  });

  assert.deepEqual(trackingInfo, [{
    provider: 'Blue Dart',
    number: 'BD123',
    url: 'https://track.example/BD123',
    dateShipped: '',
  }]);
});

test('extracts AST custom tracking links from flattened WooCommerce fields', () => {
  assert.deepEqual(extractWooTrackingInfo({
    tracking_provider: 'DTDC',
    tracking_number: '539',
    custom_tracking_link: 'https://track.example/539',
  }), [{
    provider: 'DTDC',
    number: '539',
    url: 'https://track.example/539',
    dateShipped: '',
  }]);

  assert.deepEqual(extractWooTrackingInfo({
    meta_data: [
      { key: '_tracking_provider', value: 'DTDC' },
      { key: '_tracking_number', value: '539' },
      { key: '_custom_tracking_link', value: 'https://track.example/539' },
    ],
  }), [{
    provider: 'DTDC',
    number: '539',
    url: 'https://track.example/539',
    dateShipped: '',
  }]);
});

test('uses configured courier URL template when AST provides no URL', () => {
  assert.deepEqual(extractWooTrackingInfo({
    meta_data: [{
      key: '_wc_shipment_tracking_items',
      value: [{ tracking_provider: 'Blue Care', tracking_number: 'AWB 527' }],
    }],
  }, {
    'blue care': 'https://carrier.example/track?awb={{tracking_number}}',
  }), [{
    provider: 'Blue Care',
    number: 'AWB 527',
    url: 'https://carrier.example/track?awb=AWB%20527',
    dateShipped: '',
  }]);
});

test('prefers the URL supplied by AST over configured courier fallback', () => {
  assert.deepEqual(extractWooTrackingInfo({
    meta_data: [{
      key: '_wc_shipment_tracking_items',
      value: [{
        tracking_provider: 'Blue Care',
        tracking_number: '527',
        tracking_link: 'https://ast.example/track/527',
      }],
    }],
  }, {
    'blue care': 'https://carrier.example/track?awb={{tracking_number}}',
  })?.[0].url, 'https://ast.example/track/527');
});

test('selects synced approved welcome templates and maps supported placeholders', () => {
  const templates = [
    { name: 'customer_welcome', status: 'PENDING', components: [{ type: 'BODY', text: 'Hi {{1}}' }] },
    { name: 'welcome_offer', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hi {{1}}, welcome to {{2}}!' }] },
    { name: 'customer_welcome', status: 'APPROVED', components: [{ type: 'BODY', text: 'Welcome {{1}} to {{2}}.' }] },
    { name: 'welcome_dynamic_header', status: 'APPROVED', components: [
      { type: 'HEADER', text: '{{1}}' },
      { type: 'BODY', text: 'Welcome {{1}}.' },
    ] },
    { name: 'welcome_unsupported', status: 'APPROVED', components: [{ type: 'BODY', text: '{{1}} {{2}} {{3}}' }] },
  ];
  const template = findWooCustomerWelcomeTemplate(templates);

  assert.equal(template?.name, 'customer_welcome');
  assert.deepEqual(buildWooCustomerWelcomeTemplateParameters({
    template,
    customerName: 'Test Customer',
    storeName: 'Test Store',
  }), ['Test Customer', 'Test Store']);
  assert.equal(
    buildWooCustomerWelcomeMessage({ customerName: 'Test Customer', storeName: 'Test Store' }),
    "👋 Welcome to *Test Store*, *Test Customer*! We're glad you're here.",
  );
  assert.equal(findWooCustomerWelcomeTemplate([]), null);
});

test('selects only synced approved shipment templates with the expected four placeholders', () => {
  const templates = [
    { name: 'order_shipped', status: 'PENDING', components: [{ type: 'BODY', text: '{{1}} {{2}} {{3}} {{4}}' }] },
    { name: 'order_tracking', status: 'APPROVED', components: [{ type: 'BODY', text: '{{1}} {{2}} {{3}}' }] },
    { name: 'shipment_update', status: 'APPROVED', components: [{ type: 'BODY', text: '{{1}} {{2}} {{3}} {{4}}' }] },
    { name: 'order_shipped', status: 'APPROVED', components: [{ type: 'BODY', text: '{{1}} {{2}} {{3}} {{4}}' }] },
  ];

  assert.equal(findWooShipmentTemplate(templates)?.name, 'order_shipped');
  assert.equal(findWooShipmentTemplate(templates.slice(0, 3))?.name, 'shipment_update');
  assert.equal(findWooShipmentTemplate([]), null);
});

test('builds shipment template parameters with courier and live tracking URL', () => {
  assert.deepEqual(buildWooShipmentTemplateParameters({
    customerName: 'Test Customer',
    orderNumber: '536',
    trackingInfo: [
      { provider: 'Blue Dart', url: 'https://track.example/BD123' },
      { provider: 'Delhivery', url: 'https://track.example/DL456' },
      { provider: '', url: 'https://track.example/missing-courier' },
    ],
  }), [
    'Test Customer',
    '536',
    'Blue Dart, Delhivery',
    'https://track.example/BD123\nhttps://track.example/DL456',
  ]);
  assert.equal(buildWooShipmentTemplateParameters({
    customerName: 'Test Customer',
    orderNumber: '536',
    trackingInfo: [{ provider: 'Blue Dart', url: '' }],
  }), null);
});

test('creates one receipt with payment status for a new order', () => {
  const message = buildWooOrderLifecycleMessage({
    isNewOrder: true,
    customerName: 'Test Customer',
    orderNumber: '536',
    currency: 'INR',
    total: 3100,
    lineItems: 'Product (x1)',
    paymentMethod: 'Razorpay',
    paymentStatus: 'PAID',
  });

  assert.match(message, /Order Confirmation/);
  assert.match(message, /Razorpay/);
  assert.match(message, /Payment status:\* Paid/);
  assert.match(message, /Product \(x1\)/);
});

test('does not create duplicate messages when status, payment, and tracking are unchanged', () => {
  assert.equal(buildWooOrderLifecycleMessage({
    isNewOrder: false,
    previousStatus: 'processing',
    status: 'processing',
    previousPaymentStatus: 'paid',
    paymentStatus: 'PAID',
    hasTrackingChanged: false,
  }), null);
});

test('creates shipped and delivered updates with tracking and review prompt', () => {
  const trackingInfo = [{ provider: 'Blue Dart', number: 'BD123', url: 'https://track.example/BD123' }];
  const shipped = buildWooOrderLifecycleMessage({
    isNewOrder: false,
    previousStatus: 'processing',
    status: 'shipped',
    previousPaymentStatus: 'paid',
    paymentStatus: 'PAID',
    customerName: 'Test Customer',
    orderNumber: '536',
    hasTrackingChanged: true,
    trackingInfo,
  });
  assert.match(shipped, /Blue Dart/);
  assert.match(shipped, /BD123/);
  assert.match(shipped, /https:\/\/track\.example\/BD123/);

  const delivered = buildWooOrderLifecycleMessage({
    isNewOrder: false,
    previousStatus: 'shipped',
    status: 'delivered',
    previousPaymentStatus: 'paid',
    paymentStatus: 'PAID',
    customerName: 'Test Customer',
    orderNumber: '536',
  });
  assert.match(delivered, /rating from 1 to 5/);
});

test('first received order.updated event creates a status update, not an order confirmation', () => {
  const update = buildWooOrderLifecycleMessage({
    isNewOrder: false,
    status: 'completed',
    previousPaymentStatus: undefined,
    paymentStatus: 'PENDING',
    customerName: 'Test Customer',
    orderNumber: '527',
    hasTrackingChanged: true,
    trackingInfo: [{
      provider: 'DTDC',
      number: '539',
      url: 'https://track.example/539',
    }],
  });

  assert.match(update, /Order Update/);
  assert.doesNotMatch(update, /Order Confirmation/);
  assert.match(update, /Order status: \*Completed\*/);
  assert.match(update, /DTDC/);
  assert.match(update, /https:\/\/track\.example\/539/);
});

test('includes previously saved tracking when order later reaches completed', () => {
  const completed = buildWooOrderLifecycleMessage({
    isNewOrder: false,
    previousStatus: 'shipped',
    status: 'completed',
    previousPaymentStatus: 'paid',
    paymentStatus: 'PAID',
    customerName: 'Test Customer',
    orderNumber: '536',
    hasTrackingChanged: false,
    trackingInfo: [{ provider: 'Blue Dart', number: 'BD123', url: 'https://track.example/BD123' }],
  });

  assert.match(completed, /Your order is complete/);
  assert.match(completed, /BD123/);
  assert.match(completed, /https:\/\/track\.example\/BD123/);
});

test('notifies on payment changes and terminal order statuses', () => {
  const paid = buildWooOrderLifecycleMessage({
    isNewOrder: false,
    previousStatus: 'processing',
    status: 'processing',
    previousPaymentStatus: 'pending',
    paymentStatus: 'PAID',
    customerName: 'Test Customer',
    orderNumber: '536',
  });
  assert.match(paid, /Payment status: \*Pending\* → \*Paid\*/);

  for (const [status, expected] of [
    ['cancelled', /cancelled/],
    ['refunded', /Refund timing depends on your payment provider/],
    ['failed', /payment failed/i],
  ]) {
    const message = buildWooOrderLifecycleMessage({
      isNewOrder: false,
      previousStatus: 'processing',
      status,
      previousPaymentStatus: 'paid',
      paymentStatus: status === 'refunded' ? 'REFUNDED' : status === 'failed' ? 'FAILED' : 'PAID',
      customerName: 'Test Customer',
      orderNumber: '536',
    });
    assert.match(message, expected);
  }
});

test('parses only explicit one-to-five rating replies', () => {
  assert.equal(parseWooReviewRating('5'), 5);
  assert.equal(parseWooReviewRating('4/5'), 4);
  assert.equal(parseWooReviewRating('3 stars'), 3);
  assert.equal(parseWooReviewRating('great product'), null);
  assert.equal(parseWooReviewRating('10'), null);
});
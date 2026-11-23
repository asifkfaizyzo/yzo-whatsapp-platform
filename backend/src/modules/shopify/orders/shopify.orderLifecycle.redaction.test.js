import assert from "node:assert/strict";
import { mock, test } from "node:test";

const state = {};

function resetState() {
  Object.assign(state, {
    redaction: null,
    redactionQueries: [],
    shopifyStoreCalls: 0,
    storeFindResults: [],
    storeQueries: [],
    orderCreates: 0,
    syncCalls: 0,
    customerMappingCalls: 0,
    messageCreates: 0,
    apiCalls: 0,
    scheduleCalls: 0,
    tenantWhatsAppConfig: null,
    redactionOnTemplateLookup: false,
    conversationUpdates: 0,
    currentOrder: {
      id: "order-1",
      tenantId: "tenant-1",
      shopifyStoreId: "store-1",
      shopifyCustomerId: "customer-1",
      externalOrderId: "order-1",
      orderNumber: "#1001",
      customerPhone: "+15551234567",
      customerName: "Test Customer",
      customerEmail: "test@example.invalid",
      paymentStatus: "PENDING",
      status: "processing",
    },
  });
}

resetState();

const contact = {
  id: "contact-1",
  tenantId: "tenant-1",
  name: "Test Customer",
};
const conversation = { id: "conversation-1" };
const prismaMock = {
  shopifyStore: {
    findFirst: async ({ where }) => {
      state.shopifyStoreCalls++;
      state.storeQueries.push(where);
      if (state.storeFindResults.length) return state.storeFindResults.shift();
      return where.id === "store-1" && where.tenantId === "tenant-1" &&
        where.status === "active" && where.redactedAt === null
        ? { id: "store-1" }
        : null;
    },
  },
  shopifyCustomerRedaction: {
    findUnique: async ({ where }) => {
      state.redactionQueries.push(where.storeId_shopifyCustomerId);
      return state.redaction?.storeId ===
          where.storeId_shopifyCustomerId.storeId &&
        state.redaction?.shopifyCustomerId ===
          where.storeId_shopifyCustomerId.shopifyCustomerId
        ? state.redaction
        : null;
    },
  },
  ecommerceOrder: {
    findFirst: async () => state.currentOrder,
    create: async ({ data }) => {
      state.orderCreates++;
      return { id: "order-1", ...data };
    },
  },
  shopifyCustomerMapping: {
    findFirst: async () => {
      state.customerMappingCalls++;
      return {
        tenantId: "tenant-1",
        contact,
      };
    },
  },
  conversation: {
    findFirst: async () => conversation,
    update: async () => {
      state.conversationUpdates++;
    },
  },
  message: {
    create: async ({ data }) => {
      state.messageCreates++;
      return { id: "message-1", ...data };
    },
  },
  tenantWhatsApp: {
    findUnique: async () => state.tenantWhatsAppConfig,
  },
  template: {
    findFirst: async () => {
      if (state.redactionOnTemplateLookup) {
        state.redaction = { storeId: "store-1", shopifyCustomerId: "customer-1" };
      }
      return { name: "approved-template", language: "en_US" };
    },
  },
  webhookEvent: {
    findFirst: async () => null,
    create: async () => ({}),
  },
};

const moduleMocks = [
  mock.module(new URL("../../../config/prisma.js", import.meta.url).href, {
    defaultExport: prismaMock,
  }),
  mock.module("axios", {
    defaultExport: { post: async () => { state.apiCalls++; return { data: { messages: [{ id: "wamid-1" }] } }; } },
  }),
  mock.module(new URL("../../../lib/crypto.js", import.meta.url).href, {
    namedExports: { decrypt: (value) => value },
  }),
  mock.module(new URL("../../../lib/socket.js", import.meta.url).href, {
    namedExports: { emitToTenant: () => {} },
  }),
  mock.module(
    new URL("../../google-sheets/googleSheets.service.js", import.meta.url)
      .href,
    { namedExports: { logLeadStatusToSheet: async () => {} } },
  ),
  mock.module(
    new URL("../../../cron/queues/order-webhook.queue.js", import.meta.url)
      .href,
    {
      namedExports: {
        orderWebhookQueue: {
          add: async () => {
            state.scheduleCalls++;
            return { id: "job-1" };
          },
        },
      },
    },
  ),
  mock.module(new URL("./shopify.cartRecovery.service.js", import.meta.url).href, {
    namedExports: {
      handleCheckoutUpdate: async () => ({}),
      cancelCartReminders: async () => ({}),
    },
  }),
  mock.module(
    new URL("../customers/shopify.customerSync.service.js", import.meta.url)
      .href,
    {
      namedExports: {
        syncShopifyCustomer: async () => {
          state.syncCalls++;
          return null;
        },
      },
    },
  ),
  mock.module(new URL("./shopify.postPurchase.service.js", import.meta.url).href, {
    namedExports: {
      scheduleReviewRequest: async () => { state.scheduleCalls++; },
      scheduleCrossSell: async () => { state.scheduleCalls++; },
      scheduleUpsell: async () => { state.scheduleCalls++; },
    },
  }),
  mock.module(
    new URL("../../../lib/utils/tracking.helper.js", import.meta.url).href,
    { namedExports: { generateTrackingUrl: () => "" } },
  ),
];

const {
  processShopifyOrderLifecycle,
  processShopifyPaymentReminderJob,
  saveShopifyInboxMessage,
  sendShopifyWhatsAppTemplate,
} = await import("./shopify.orderLifecycle.js");

const lifecycleRequest = (topic, payload) => ({
  tenantId: "tenant-1",
  storeId: "store-1",
  topic,
  shopDomain: "shop.example",
  payload,
});

test("order lifecycle skips a redacted webhook customer before order writes", async () => {
  resetState();
  state.redaction = { storeId: "store-1", shopifyCustomerId: "customer-1" };

  const result = await processShopifyOrderLifecycle(
    lifecycleRequest("orders/create", {
      id: "order-1",
      customer: { id: "customer-1", phone: "+15551234567" },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    skipped: true,
    reason: "customer_redacted",
    topic: "orders/create",
  });
  assert.deepEqual(state.redactionQueries, [
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
  ]);
  assert.equal(state.orderCreates, 0);
  assert.equal(state.customerMappingCalls, 0);
  assert.equal(state.messageCreates, 0);
});

test("customer topics use payload.id for tombstone lookup", async () => {
  resetState();
  state.redaction = { storeId: "store-1", shopifyCustomerId: "customer-1" };

  const result = await processShopifyOrderLifecycle(
    lifecycleRequest("customers/create", {
      id: "customer-1",
      phone: "+15551234567",
      email: "test@example.invalid",
    }),
  );

  assert.equal(result.reason, "customer_redacted");
  assert.deepEqual(state.redactionQueries, [
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
  ]);
  assert.equal(state.orderCreates, 0);
  assert.equal(state.syncCalls, 0);
});

test("normal customer update continues when only another store has a tombstone", async () => {
  resetState();
  state.redaction = {
    storeId: "another-store",
    shopifyCustomerId: "customer-1",
  };

  const result = await processShopifyOrderLifecycle(
    lifecycleRequest("customers/update", {
      id: "customer-1",
      first_name: "Test",
      last_name: "Customer",
      phone: "+15551234567",
      email: "test@example.invalid",
    }),
  );

  assert.equal(result.success, true);
  assert.equal(result.topic, "customers/update");
  assert.equal(state.orderCreates, 1);
  assert.equal(state.syncCalls, 1);
  assert.deepEqual(state.redactionQueries, [
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
  ]);
});

test("payment reminder skips a tombstoned store-scoped order customer", async () => {
  resetState();
  state.redaction = { storeId: "store-1", shopifyCustomerId: "customer-1" };

  const result = await processShopifyPaymentReminderJob({
    tenantId: "tenant-1",
    storeId: "store-1",
    externalOrderId: "order-1",
  });

  assert.deepEqual(result, {
    success: true,
    skipped: true,
    reason: "customer_redacted",
  });
  assert.deepEqual(state.redactionQueries, [
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
  ]);
  assert.equal(state.customerMappingCalls, 0);
  assert.equal(state.messageCreates, 0);
});

test("normal payment reminder continues when no tombstone exists", async () => {
  resetState();

  const result = await processShopifyPaymentReminderJob({
    tenantId: "tenant-1",
    storeId: "store-1",
    externalOrderId: "order-1",
  });

  assert.equal(result.type, "SHOPIFY_REMINDER");
  assert.equal(state.customerMappingCalls, 1);
  assert.equal(state.messageCreates, 1);
  assert.deepEqual(state.redactionQueries, [
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
  ]);
});

test("null customer IDs preserve payment reminder behavior without a tombstone query", async () => {
  resetState();
  state.currentOrder.shopifyCustomerId = null;

  const result = await processShopifyPaymentReminderJob({
    tenantId: "tenant-1",
    storeId: "store-1",
    externalOrderId: "order-1",
  });

  assert.equal(result.type, "SHOPIFY_REMINDER");
  assert.equal(state.redactionQueries.length, 0);
  assert.equal(state.customerMappingCalls, 0);
  assert.equal(state.messageCreates, 0);
});

const inboxArgs = (shopifyCustomerId = "customer-1") => ({
  tenantId: "tenant-1",
  storeId: "store-1",
  shopifyCustomerId,
  conversation,
  contact,
  messageText: "Shopify customer update",
  orderRecord: null,
});

const withProductionBackend = async (callback) => {
  const previous = process.env.BACKEND_URL;
  process.env.BACKEND_URL = "https://production.example";
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
  }
};

test("Shopify inbox and template sends continue for an active store and customer", async () => {
  resetState();
  const inboxResult = await saveShopifyInboxMessage(inboxArgs());
  assert.equal(inboxResult.id, "message-1");
  assert.equal(state.messageCreates, 1);
  assert.deepEqual(state.storeQueries.at(-1), {
    id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null,
  });

  await withProductionBackend(async () => {
    state.tenantWhatsAppConfig = {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    };
    const result = await sendShopifyWhatsAppTemplate({
      tenantId: "tenant-1",
      storeId: "store-1",
      shopifyCustomerId: "customer-1",
      customerPhone: "+15551234567",
      templateNamePatterns: ["test"],
      templateParams: [],
    });
    assert.ok(result);
  });
  assert.equal(state.apiCalls, 1);
});

test("redacted store blocks Shopify inbox creation and WhatsApp API call", async () => {
  resetState();
  state.storeFindResults = [null, null];
  const inboxResult = await saveShopifyInboxMessage(inboxArgs());
  assert.deepEqual(inboxResult, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });

  await withProductionBackend(async () => {
    state.tenantWhatsAppConfig = {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    };
    const sendResult = await sendShopifyWhatsAppTemplate({
      tenantId: "tenant-1",
      storeId: "store-1",
      shopifyCustomerId: "customer-1",
      customerPhone: "+15551234567",
      templateNamePatterns: ["test"],
      templateParams: [],
    });
    assert.deepEqual(sendResult, {
      skipped: true,
      reason: "shopify_store_missing_or_inactive",
    });
  });
  assert.equal(state.messageCreates, 0);
  assert.equal(state.apiCalls, 0);
});

test("exact customer tombstone blocks inbox creation and WhatsApp API call", async () => {
  resetState();
  state.redaction = { storeId: "store-1", shopifyCustomerId: "customer-1" };
  assert.deepEqual(await saveShopifyInboxMessage(inboxArgs()), {
    skipped: true,
    reason: "customer_redacted",
  });

  await withProductionBackend(async () => {
    state.tenantWhatsAppConfig = {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    };
    const result = await sendShopifyWhatsAppTemplate({
      tenantId: "tenant-1",
      storeId: "store-1",
      shopifyCustomerId: "customer-1",
      customerPhone: "+15551234567",
      templateNamePatterns: ["test"],
      templateParams: [],
    });
    assert.deepEqual(result, { skipped: true, reason: "customer_redacted" });
  });
  assert.equal(state.messageCreates, 0);
  assert.equal(state.apiCalls, 0);
});

test("a tombstone for another store does not block this store", async () => {
  resetState();
  state.redaction = { storeId: "another-store", shopifyCustomerId: "customer-1" };
  assert.equal((await saveShopifyInboxMessage(inboxArgs())).id, "message-1");

  await withProductionBackend(async () => {
    state.tenantWhatsAppConfig = {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    };
    await sendShopifyWhatsAppTemplate({
      tenantId: "tenant-1",
      storeId: "store-1",
      shopifyCustomerId: "customer-1",
      customerPhone: "+15551234567",
      templateNamePatterns: ["test"],
      templateParams: [],
    });
  });
  assert.equal(state.messageCreates, 1);
  assert.equal(state.apiCalls, 1);
});

test("missing customer ID skips tombstone lookup but still requires an active store", async () => {
  resetState();
  const result = await saveShopifyInboxMessage(inboxArgs(null));
  assert.equal(result.id, "message-1");
  assert.equal(state.redactionQueries.length, 0);
  await withProductionBackend(async () => {
    state.tenantWhatsAppConfig = {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    };
    const sendResult = await sendShopifyWhatsAppTemplate({
      tenantId: "tenant-1",
      storeId: "store-1",
      shopifyCustomerId: null,
      customerPhone: "+15551234567",
      templateNamePatterns: ["test"],
      templateParams: [],
    });
    assert.ok(sendResult);
  });
  assert.equal(state.apiCalls, 1);
  assert.equal(state.redactionQueries.length, 0);

  resetState();
  state.storeFindResults = [null];
  const inactiveResult = await saveShopifyInboxMessage(inboxArgs(null));
  assert.deepEqual(inactiveResult, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.messageCreates, 0);
  assert.equal(state.redactionQueries.length, 0);
});

test("lifecycle stops after a late store guard failure before messaging or scheduling", async () => {
  resetState();
  // The first result is the lifecycle entry check; the next is the inbox guard.
  state.storeFindResults = [{ id: "store-1" }, null];

  const result = await processShopifyOrderLifecycle(
    lifecycleRequest("orders/create", {
      id: "order-2",
      customer: { id: "customer-1", phone: "+15551234567" },
    }),
  );

  assert.deepEqual(result, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.messageCreates, 0);
  assert.equal(state.apiCalls, 0);
  assert.equal(state.scheduleCalls, 0);
});

test("lifecycle stops before scheduling a payment reminder when the store is redacted", async () => {
  resetState();
  // Entry and inbox checks pass; the store is redacted before the enqueue guard.
  state.storeFindResults = [{ id: "store-1" }, { id: "store-1" }, null];

  const result = await processShopifyOrderLifecycle(
    lifecycleRequest("orders/create", {
      id: "order-3",
      customer: { id: "customer-1", phone: "+15551234567" },
    }),
  );

  assert.deepEqual(result, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.messageCreates, 1);
  assert.equal(state.scheduleCalls, 0);
});

test("template guard catches a tombstone created during template lookup", async () => {
  resetState();
  state.redactionOnTemplateLookup = true;
  await withProductionBackend(async () => {
    state.tenantWhatsAppConfig = {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    };
    const result = await sendShopifyWhatsAppTemplate({
      tenantId: "tenant-1",
      storeId: "store-1",
      shopifyCustomerId: "customer-1",
      customerPhone: "+15551234567",
      templateNamePatterns: ["test"],
      templateParams: [],
    });
    assert.deepEqual(result, { skipped: true, reason: "customer_redacted" });
  });
  assert.equal(state.apiCalls, 0);
});

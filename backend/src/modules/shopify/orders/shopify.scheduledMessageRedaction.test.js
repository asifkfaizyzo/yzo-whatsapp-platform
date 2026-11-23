import assert from "node:assert/strict";
import { mock, test } from "node:test";

const state = {};

function resetState() {
  Object.assign(state, {
    redactions: [],
    redactionQueries: [],
    storeFindQueries: [],
    storeFindResults: [],
    storeActive: true,
    storeGuardErrorAfter: null,
    redactAtPostPurchaseGuard: false,
    redactionQueryErrorAfter: null,
    queueAdds: [],
    existingCartJob: null,
    shopifyConnectionConfigs: [],
    cronOrders: [],
    recentOrdersByPhone: {},
    productionMode: false,
    redactBeforeSendCheck: false,
    tombstoneBeforeSendCheck: false,
    redactAfterFirstText: false,
    redactDuringTemplateLookup: false,
    redactAfterTemplateRequest: false,
    failTemplateSend: false,
    apiCalls: 0,
    templateCalls: 0,
    sentPayloads: [],
    tenantWhatsAppConfig: {
      whatsappPhoneId: "phone-id",
      whatsappAccessToken: "token",
    },
    order: {
      id: "order-1",
      tenantId: "tenant-1",
      source: "SHOPIFY",
      shopifyStoreId: "store-1",
      shopifyCustomerId: "customer-1",
      customerPhone: "+15551234567",
      customerName: "Test Customer",
      customerEmail: "test@example.invalid",
      orderNumber: "#1001",
      lineItems: [],
      status: "delivered",
      reviewRating: null,
      reviewRequestedAt: null,
      crossSellSentAt: null,
      upsellSentAt: null,
      reorderReminderSentAt: null,
    },
    recentOrder: null,
    cartFindCalls: 0,
    cartOrder: {
      cartStatus: "abandoned",
      customerPhone: "+15551234567",
      customerEmail: "test@example.invalid",
      customerName: "Test Customer",
      cartReminder1SentAt: null,
    },
    contactCalls: 0,
    sendCalls: 0,
    inboxCalls: 0,
    updateCalls: 0,
    updateArgs: [],
    productCalls: 0,
    storeCalls: 0,
  });
}

resetState();

const prismaMock = {
  shopifyCustomerRedaction: {
    findUnique: async ({ where }) => {
      state.redactionQueries.push(where.storeId_shopifyCustomerId);
      if (state.redactionQueryErrorAfter === state.redactionQueries.length) {
        throw new Error("redaction query failed");
      }
      return state.redactions.find(
        (redaction) =>
          redaction.storeId === where.storeId_shopifyCustomerId.storeId &&
          redaction.shopifyCustomerId ===
            where.storeId_shopifyCustomerId.shopifyCustomerId,
      ) ?? null;
    },
  },
  shopifyStore: {
    findFirst: async ({ where }) => {
      state.storeCalls++;
      state.storeFindQueries.push(where);
      if (state.redactAtPostPurchaseGuard && state.storeCalls === 2) {
        state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-1" });
      }
      if (state.storeGuardErrorAfter === state.storeCalls) {
        throw new Error("store query failed");
      }
      if (state.storeFindResults.length) return state.storeFindResults.shift();
      return state.storeActive && where.id === "store-1" &&
        where.tenantId === "tenant-1" && where.status === "active" &&
        where.redactedAt === null
        ? { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null }
        : null;
    },
  },
  ecommerceOrder: {
    findMany: async () => state.cronOrders,
    findFirst: async ({ where }) => {
      if (where.id) return state.order;
      if (where.externalOrderId) {
        state.cartFindCalls++;
        if (state.cartFindCalls === 3 && state.redactBeforeSendCheck) {
          state.storeActive = false;
        }
        if (state.cartFindCalls === 3 && state.tombstoneBeforeSendCheck) {
          state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-1" });
        }
        if (state.cartFindCalls === 2) return state.cartOrder;
        if (state.cartFindCalls === 3) {
          return { id: "cart-1", cartStatus: "abandoned" };
        }
        return null;
      }
      if (where.createdAt?.gte) {
        return state.recentOrdersByPhone[where.customerPhone] ?? state.recentOrder;
      }
      if (where.customerPhone) return null;
      return null;
    },
    updateMany: async ({ where, data }) => {
      state.updateCalls++;
      state.updateArgs.push({ where, data });
      return { count: 1 };
    },
  },
  shopifyConnection: {
    findFirst: async () => ({ shopName: "shop.example" }),
    findMany: async () => state.shopifyConnectionConfigs,
    findUnique: async () => ({
      postPurchaseReviewEnabled: true,
      postPurchaseCrossSellEnabled: true,
      postPurchaseUpsellEnabled: true,
    }),
  },
  tenant: {
    findUnique: async () => ({ tenantName: "Test Store" }),
  },
  tenantWhatsApp: {
    findUnique: async () => state.tenantWhatsAppConfig,
  },
  template: {
    findFirst: async () => {
      state.templateCalls++;
      if (state.redactDuringTemplateLookup) state.storeActive = false;
      return {
        name: "cart_reminder_1h",
        language: "en_US",
        components: [{ type: "BODY", text: "{{1}} {{2}} {{3}} {{4}} {{5}}" }],
        buttons: [],
        bodyParams: 5,
        headerType: "TEXT",
      };
    },
  },
  shopifyProduct: {
    findFirst: async () => {
      state.productCalls++;
      if (state.productCalls === 1) {
        return { id: "purchased-product", productType: "care", vendor: "brand" };
      }
      return {
        id: "related-product",
        title: "Recommended item",
        productUrl: "https://shop.example/product",
        variants: [{ price: "10", currency: "USD" }],
      };
    },
    findMany: async () => {
      state.productCalls++;
      return [{
        id: "related-product",
        title: "Recommended item",
        productUrl: "https://shop.example/product",
        variants: [{ price: "10", currency: "USD" }],
      }];
    },
  },
};

const moduleMocks = [
  mock.module(new URL("../../../config/prisma.js", import.meta.url).href, {
    defaultExport: prismaMock,
  }),
  mock.module("axios", {
    defaultExport: {
      post: async () => {
        state.apiCalls++;
        if (state.redactAfterTemplateRequest) state.storeActive = false;
        if (state.failTemplateSend) throw new Error("template send failed");
        return { data: { messages: [{ id: "wamid-1" }] } };
      },
    },
  }),
  mock.module(new URL("../../../lib/crypto.js", import.meta.url).href, {
    namedExports: { decrypt: (value) => value },
  }),
  mock.module(new URL("../shopify.service.js", import.meta.url).href, {
    namedExports: { getShopifyAccessToken: async () => null },
  }),
  mock.module(
    new URL("../../../cron/queues/order-webhook.queue.js", import.meta.url)
      .href,
    {
      namedExports: {
        orderWebhookQueue: {
          add: async (...args) => {
            state.queueAdds.push(args);
            return { id: "job-1" };
          },
          getJob: async () => state.existingCartJob,
        },
      },
    },
  ),
  mock.module(new URL("../../messages/message.service.js", import.meta.url).href, {
    namedExports: {
      sendMessageService: async (payload) => {
        state.sendCalls++;
        state.sentPayloads.push(payload);
        if (state.redactAfterFirstText && state.sendCalls === 1) {
          state.storeActive = false;
        }
        return { id: "sent-message" };
      },
    },
  }),
  mock.module(new URL("./shopify.orderLifecycle.js", import.meta.url).href, {
    namedExports: {
      getOrCreateShopifyContact: async () => {
        state.contactCalls++;
        return {
          contact: { id: "contact-1" },
          conversation: { id: "conversation-1" },
        };
      },
      saveShopifyInboxMessage: async () => {
        if (state.inboxResult) return state.inboxResult;
        state.inboxCalls++;
        return { id: "message-1" };
      },
      isProductionEnvironment: () => state.productionMode,
    },
  }),
  mock.module(new URL("./shopify.postPurchaseMessages.js", import.meta.url).href, {
    namedExports: {
      buildReviewRequestMessage: () => "review message",
      buildCrossSellMessage: () => "cross-sell message",
      buildUpsellMessage: () => "upsell message",
      buildReorderReminderMessage: () => "reorder message",
      buildWinBackMessage: () => "win-back message",
      parseShopifyReviewRating: () => null,
    },
  }),
];

const { processCartReminder, scheduleCartReminders } = await import("./shopify.cartRecovery.service.js");
const {
  scheduleReviewRequest,
  scheduleCrossSell,
  scheduleUpsell,
  processReviewRequestJob,
  processCrossSellJob,
  processUpsellJob,
  processReorderReminderJob,
  processWinBackJob,
} = await import("./shopify.postPurchase.service.js");
const { runShopifyReorderReminders } = await import("../../../cron/jobs/shopify-reorder.job.js");
const { runShopifyWinBackCampaign } = await import("../../../cron/jobs/shopify-win-back.job.js");

const cartJob = {
  tenantId: "tenant-1",
  storeId: "store-1",
  shopifyCustomerId: "customer-1",
  checkoutId: "checkout-1",
  customerPhone: "+15551234567",
  total: 25,
  currency: "USD",
  lineItems: [],
  productSummary: "item",
  tier: "1h",
};

const postPurchaseJob = {
  tenantId: "tenant-1",
  storeId: "store-1",
  ecommerceOrderId: "order-1",
  orderNumber: "#1001",
  customerPhone: "+15551234567",
  customerName: "Test Customer",
  lineItems: [],
};

const postPurchaseProcessors = [
  ["review", processReviewRequestJob],
  ["cross-sell", processCrossSellJob],
  ["upsell", processUpsellJob],
  ["reorder", processReorderReminderJob],
  ["win-back", processWinBackJob],
];

test("cart reminder checks the exact job store/customer tombstone before sending", async () => {
  resetState();
  state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-1" });

  const result = await processCartReminder(cartJob);

  assert.deepEqual(result, { skipped: true, reason: "customer_redacted" });
  assert.deepEqual(state.redactionQueries, [
    { storeId: "store-1", shopifyCustomerId: "customer-1" },
  ]);
  assert.equal(state.sendCalls, 0);
  assert.equal(state.inboxCalls, 0);
  assert.equal(state.cartFindCalls, 0);
});

test("each post-purchase processor blocks a tombstoned order customer before customer actions", async () => {
  for (const [name, processor] of postPurchaseProcessors) {
    resetState();
    state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-1" });

    const result = await processor(postPurchaseJob);

    assert.deepEqual(result, { skipped: true, reason: "customer_redacted" }, name);
    assert.deepEqual(state.redactionQueries, [
      { storeId: "store-1", shopifyCustomerId: "customer-1" },
    ], name);
    assert.equal(state.storeCalls, 0, name);
    assert.equal(state.contactCalls, 0, name);
    assert.equal(state.inboxCalls, 0, name);
    assert.equal(state.updateCalls, 0, name);
  }
});

test("all post-purchase processors update markers and create inbox messages for active customers", async () => {
  const markerFields = {
    review: "reviewRequestedAt",
    "cross-sell": "crossSellSentAt",
    upsell: "upsellSentAt",
    reorder: "reorderReminderSentAt",
    "win-back": "winBackSentAt",
  };
  for (const [name, processor] of postPurchaseProcessors) {
    resetState();
    if (name === "upsell") state.order.status = "processing";

    const result = await processor(postPurchaseJob);

    assert.equal(result.success, true, name);
    assert.equal(state.updateCalls, 1, name);
    assert.equal(state.inboxCalls, 1, name);
    assert.equal(state.updateArgs[0].where.shopifyStoreId, "store-1", name);
    assert.deepEqual(Object.keys(state.updateArgs[0].data), [markerFields[name]], name);
    assert.ok(state.updateArgs[0].data[markerFields[name]] instanceof Date, name);
  }
});

test("a store redaction immediately before each post-purchase marker suppresses all side effects", async () => {
  for (const [name, processor] of postPurchaseProcessors) {
    resetState();
    if (name === "upsell") state.order.status = "processing";
    state.storeFindResults = [
      { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null },
      null,
    ];

    const result = await processor(postPurchaseJob);

    assert.deepEqual(result, {
      skipped: true,
      reason: "inactive_or_invalid_store",
    }, name);
    assert.equal(state.updateCalls, 0, name);
    assert.equal(state.inboxCalls, 0, name);
  }
});

test("an exact customer tombstone immediately before each marker suppresses all side effects", async () => {
  for (const [name, processor] of postPurchaseProcessors) {
    resetState();
    if (name === "upsell") state.order.status = "processing";
    state.redactAtPostPurchaseGuard = true;

    const result = await processor(postPurchaseJob);

    assert.deepEqual(result, { skipped: true, reason: "customer_redacted" }, name);
    assert.equal(state.updateCalls, 0, name);
    assert.equal(state.inboxCalls, 0, name);
  }
});

test("another store's tombstone does not block any post-purchase processor", async () => {
  for (const [name, processor] of postPurchaseProcessors) {
    resetState();
    if (name === "upsell") state.order.status = "processing";
    state.redactions.push({ storeId: "another-store", shopifyCustomerId: "customer-1" });

    const result = await processor(postPurchaseJob);

    assert.equal(result.success, true, name);
    assert.equal(state.updateCalls, 1, name);
    assert.equal(state.inboxCalls, 1, name);
  }
});

test("post-purchase redaction guard lookup errors fail closed for all processors", async () => {
  for (const [name, processor] of postPurchaseProcessors) {
    for (const failedLookup of ["store", "customer"]) {
      resetState();
      if (name === "upsell") state.order.status = "processing";
      if (failedLookup === "store") state.storeGuardErrorAfter = 2;
      else state.redactionQueryErrorAfter = 2;

      const result = await processor(postPurchaseJob);

      assert.deepEqual(result, {
        skipped: true,
        reason: "shopify_redaction_check_failed",
      }, `${name}: ${failedLookup}`);
      assert.equal(state.updateCalls, 0, `${name}: ${failedLookup}`);
      assert.equal(state.inboxCalls, 0, `${name}: ${failedLookup}`);
    }
  }
});

test("cart reminder continues sending for a customer without a tombstone", async () => {
  resetState();

  const result = await processCartReminder(cartJob);

  assert.equal(result.success, true);
  assert.equal(state.redactionQueries.length, 2);
  assert.equal(state.sendCalls, 1);
  assert.equal(state.updateCalls, 1);
  assert.ok(state.storeFindQueries.every((where) =>
    where.id === "store-1" && where.tenantId === "tenant-1" &&
    where.status === "active" && where.redactedAt === null));
});

test("cart reminder stops if the store is redacted immediately before the text send", async () => {
  resetState();
  state.redactBeforeSendCheck = true;

  const result = await processCartReminder(cartJob);

  assert.deepEqual(result, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.sendCalls, 0);
  assert.equal(state.inboxCalls, 0);
  assert.equal(state.updateCalls, 0);
});

test("cart reminder stops if the customer tombstone appears before the text send", async () => {
  resetState();
  state.tombstoneBeforeSendCheck = true;

  const result = await processCartReminder(cartJob);

  assert.deepEqual(result, { skipped: true, reason: "customer_redacted" });
  assert.equal(state.sendCalls, 0);
  assert.equal(state.inboxCalls, 0);
  assert.equal(state.updateCalls, 0);
});

test("cart image is not sent when redaction occurs after the text send", async () => {
  resetState();
  state.redactAfterFirstText = true;

  const result = await processCartReminder({
    ...cartJob,
    productImageUrl: "https://cdn.example.invalid/product.jpg",
  });

  assert.deepEqual(result, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.sendCalls, 1);
  assert.equal(state.sentPayloads[0].type, undefined);
  assert.equal(state.inboxCalls, 0);
  assert.equal(state.updateCalls, 0);
});

test("production template API call is blocked when redaction appears during template lookup", async () => {
  resetState();
  state.productionMode = true;
  state.redactDuringTemplateLookup = true;

  const result = await processCartReminder(cartJob);

  assert.deepEqual(result, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.apiCalls, 0);
  assert.equal(state.sendCalls, 0);
  assert.equal(state.inboxCalls, 0);
  assert.equal(state.updateCalls, 0);
});

test("production template send continues for an active store and customer", async () => {
  resetState();
  state.productionMode = true;

  const result = await processCartReminder(cartJob);

  assert.equal(result.success, true);
  assert.equal(state.apiCalls, 1);
  assert.equal(state.inboxCalls, 1);
  assert.equal(state.updateCalls, 1);
});

test("production text fallback is blocked if redaction occurs after template send fails", async () => {
  resetState();
  state.productionMode = true;
  state.failTemplateSend = true;
  state.redactAfterTemplateRequest = true;

  const result = await processCartReminder(cartJob);

  assert.deepEqual(result, {
    skipped: true,
    reason: "shopify_store_missing_or_inactive",
  });
  assert.equal(state.apiCalls, 1);
  assert.equal(state.sendCalls, 0);
  assert.equal(state.inboxCalls, 0);
  assert.equal(state.updateCalls, 0);
});

test("cart reminder ignores a tombstone belonging to another store", async () => {
  resetState();
  state.redactions.push({ storeId: "another-store", shopifyCustomerId: "customer-1" });

  const result = await processCartReminder(cartJob);

  assert.equal(result.success, true);
  assert.equal(state.sendCalls, 1);
  assert.equal(state.updateCalls, 1);
});

test("cart send guard errors fail closed", async () => {
  for (const failure of ["store", "customer"]) {
    resetState();
    if (failure === "store") state.storeGuardErrorAfter = 3;
    else state.redactionQueryErrorAfter = 2;

    const result = await processCartReminder(cartJob);

    assert.deepEqual(result, {
      skipped: true,
      reason: "shopify_redaction_check_failed",
    }, failure);
    assert.equal(state.sendCalls, 0, failure);
    assert.equal(state.inboxCalls, 0, failure);
    assert.equal(state.updateCalls, 0, failure);
  }
});

test("normal post-purchase processing continues and preserves null customer IDs", async () => {
  resetState();
  state.order.shopifyCustomerId = null;

  const reviewResult = await processReviewRequestJob(postPurchaseJob);

  assert.equal(reviewResult.success, true);
  assert.equal(state.redactionQueries.length, 0);
  assert.equal(state.contactCalls, 1);
  assert.equal(state.inboxCalls, 1);
});

test("each post-purchase processor continues its existing non-redaction path", async () => {
  const normalCases = [
    ["review", processReviewRequestJob, { reviewRating: 5 }, "review_already_submitted"],
    ["cross-sell", processCrossSellJob, { crossSellSentAt: new Date() }, "already_sent"],
    ["upsell", processUpsellJob, { upsellSentAt: new Date() }, "already_sent"],
    ["reorder", processReorderReminderJob, { reorderReminderSentAt: new Date() }, "already_sent_or_not_found"],
    ["win-back", processWinBackJob, {}, "customer_recently_active"],
  ];

  for (const [name, processor, orderOverrides, expectedReason] of normalCases) {
    resetState();
    Object.assign(state.order, orderOverrides);
    if (name === "win-back") state.recentOrder = { id: "recent-order" };

    const result = await processor(postPurchaseJob);

    assert.equal(result.skipped, true, name);
    assert.equal(result.reason, expectedReason, name);
    assert.equal(state.redactionQueries.length, 1, name);
  }
});

const cartScheduleData = {
  tenantId: "tenant-1",
  storeId: "store-1",
  shopifyCustomerId: "customer-1",
  checkoutId: "checkout-1",
  cartOrderId: "cart-1",
  customerPhone: "+15551234567",
  customerName: "Test Customer",
  customerEmail: "test@example.invalid",
  total: 25,
  currency: "USD",
  lineItems: [],
  productSummary: "item",
  checkoutUrl: "https://shop.example/checkout",
};

const postPurchaseSchedulers = [
  ["review", scheduleReviewRequest, "shopify-review-request"],
  ["cross-sell", scheduleCrossSell, "shopify-cross-sell"],
  ["upsell", scheduleUpsell, "shopify-upsell"],
];

const schedulePostPurchase = (scheduler) => scheduler({
  tenantId: "tenant-1",
  order: { ...state.order },
});

test("cart and post-purchase schedulers enqueue normally for active stores and customers", async () => {
  resetState();
  await scheduleCartReminders(cartScheduleData);
  assert.deepEqual(state.queueAdds.map(([name]) => name), [
    "shopify-cart-1h", "shopify-cart-24h", "shopify-cart-48h",
  ]);
    assert.deepEqual(state.queueAdds[0][2], {
    jobId: "shopify_cart_1h_tenant-1_store-1_checkout-1",
    delay: 10000,
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  });

  for (const [name, scheduler, expectedJobName] of postPurchaseSchedulers) {
    resetState();
    await schedulePostPurchase(scheduler);
    assert.equal(state.queueAdds.length, 1, name);
    assert.equal(state.queueAdds[0][0], expectedJobName, name);
    assert.equal(state.queueAdds[0][1].storeId, "store-1", name);
    assert.equal(state.queueAdds[0][1].tenantId, "tenant-1", name);
  }
});

test("cart and post-purchase schedulers skip redacted stores and exact customer tombstones", async () => {
  for (const stateChange of ["store", "customer"]) {
    resetState();
    if (stateChange === "store") state.storeActive = false;
    else state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-1" });
    await scheduleCartReminders(cartScheduleData);
    assert.equal(state.queueAdds.length, 0, `cart ${stateChange}`);

    for (const [name, scheduler] of postPurchaseSchedulers) {
      resetState();
      if (stateChange === "store") state.storeActive = false;
      else state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-1" });
      const result = await schedulePostPurchase(scheduler);
      assert.equal(state.queueAdds.length, 0, `${name} ${stateChange}`);
      assert.equal(result.skipped, true, `${name} ${stateChange}`);
    }
  }
});

test("scheduler tombstones for another store do not block jobs", async () => {
  state.redactions = [];
  for (const [, scheduler, expectedJobName] of postPurchaseSchedulers) {
    resetState();
    state.redactions.push({ storeId: "another-store", shopifyCustomerId: "customer-1" });
    await schedulePostPurchase(scheduler);
    assert.equal(state.queueAdds.length, 1, expectedJobName);
    assert.equal(state.queueAdds[0][0], expectedJobName);
  }

  for (const [name, runner] of [
    ["reorder", runShopifyReorderReminders],
    ["win-back", runShopifyWinBackCampaign],
  ]) {
    resetState();
    state.redactions.push({ storeId: "another-store", shopifyCustomerId: "customer-1" });
    state.shopifyConnectionConfigs = [{
      tenantId: "tenant-1",
      postPurchaseReorderDays: 30,
      postPurchaseWinBackDays: 90,
      store: { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null },
    }];
    state.cronOrders = [schedulerCronOrder("customer-1", "order-1", "+15551234567")];
    await runner();
    assert.equal(state.queueAdds.length, 1, name);
  }
});

function schedulerCronOrder(shopifyCustomerId, id, customerPhone) {
  return {
    id,
    shopifyCustomerId,
    shopifyStoreId: "store-1",
    customerPhone,
    customerName: "Test Customer",
    customerEmail: "test@example.invalid",
    orderNumber: "#1001",
    lineItems: [],
    createdAt: new Date("2020-01-01T00:00:00Z"),
  };
}

test("reorder and win-back skip only tombstoned customers and keep scheduling others", async () => {
  for (const [name, runner] of [
    ["reorder", runShopifyReorderReminders],
    ["win-back", runShopifyWinBackCampaign],
  ]) {
    resetState();
    state.shopifyConnectionConfigs = [{
      tenantId: "tenant-1",
      postPurchaseReorderDays: 30,
      postPurchaseWinBackDays: 90,
      store: { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null },
    }];
    state.cronOrders = [
      schedulerCronOrder("customer-redacted", "order-redacted", "+15550000001"),
      schedulerCronOrder("customer-ok", "order-ok", "+15550000002"),
    ];
    state.redactions.push({ storeId: "store-1", shopifyCustomerId: "customer-redacted" });

    await runner();

    assert.equal(state.queueAdds.length, 1, name);
    assert.equal(state.queueAdds[0][1].ecommerceOrderId, "order-ok", name);
  }
});

test("scheduler redaction lookup errors fail closed", async () => {
  resetState();
  state.storeGuardErrorAfter = 1;
  await scheduleCartReminders(cartScheduleData);
  assert.deepEqual(state.queueAdds.map(([name]) => name), [
    "shopify-cart-24h", "shopify-cart-48h",
  ]);

  resetState();
  state.redactionQueryErrorAfter = 1;
  await scheduleCartReminders(cartScheduleData);
  assert.deepEqual(state.queueAdds.map(([name]) => name), [
    "shopify-cart-24h", "shopify-cart-48h",
  ]);

  for (const [, scheduler, expectedJobName] of postPurchaseSchedulers) {
    resetState();
    state.storeGuardErrorAfter = 1;
    const result = await schedulePostPurchase(scheduler);
    assert.equal(state.queueAdds.length, 0, expectedJobName);
    assert.equal(result.reason, "shopify_redaction_check_failed", expectedJobName);

    resetState();
    state.redactionQueryErrorAfter = 1;
    const customerResult = await schedulePostPurchase(scheduler);
    assert.equal(state.queueAdds.length, 0, expectedJobName);
    assert.equal(customerResult.reason, "shopify_redaction_check_failed", expectedJobName);
  }

  for (const [name, runner] of [
    ["reorder", runShopifyReorderReminders],
    ["win-back", runShopifyWinBackCampaign],
  ]) {
    resetState();
    state.shopifyConnectionConfigs = [{
      tenantId: "tenant-1",
      store: { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null },
    }];
    state.cronOrders = [schedulerCronOrder("customer-1", "order-1", "+15551234567")];
    state.storeGuardErrorAfter = 1;
    await runner();
    assert.equal(state.queueAdds.length, 0, name);

    resetState();
    state.shopifyConnectionConfigs = [{
      tenantId: "tenant-1",
      store: { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null },
    }];
    state.cronOrders = [schedulerCronOrder("customer-1", "order-1", "+15551234567")];
    state.redactionQueryErrorAfter = 1;
    await runner();
    assert.equal(state.queueAdds.length, 0, `${name} tombstone lookup`);
  }
});

test("cron schedulers skip redacted stores without enqueueing", async () => {
  for (const [name, runner] of [
    ["reorder", runShopifyReorderReminders],
    ["win-back", runShopifyWinBackCampaign],
  ]) {
    resetState();
    state.shopifyConnectionConfigs = [{
      tenantId: "tenant-1",
      store: { id: "store-1", tenantId: "tenant-1", status: "active", redactedAt: null },
    }];
    state.cronOrders = [schedulerCronOrder("customer-1", "order-1", "+15551234567")];
    state.storeActive = false;
    await runner();
    assert.equal(state.queueAdds.length, 0, name);
  }
});

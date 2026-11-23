import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const state = { messageData: null, conversationUpdateCalls: 0 };

const prismaMock = {
  message: {
    create: async ({ data }) => {
      state.messageData = data;
      return { id: "message-1", ...data };
    },
  },
  conversation: {
    update: async () => {
      state.conversationUpdateCalls += 1;
    },
  },
};

async function loadFunction(name, injected = {}) {
  const source = await readFile(
    new URL("./shopify.orderLifecycle.js", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(`export const ${name} = `);
  assert.notEqual(start, -1, `${name} declaration exists`);
  const end = source.indexOf("\n// ─", start);
  assert.notEqual(end, -1, `${name} declaration has a following section`);
  const declaration = source
    .slice(start, end)
    .trim()
    .replace(`export const ${name} = `, `const ${name} = `);
  const parameters = Object.keys(injected);
  const values = Object.values(injected);
  return new Function(
    ...parameters,
    `${declaration}; return ${name};`,
  )(...values);
}

const saveShopifyInboxMessage = await loadFunction("saveShopifyInboxMessage", {
  prisma: prismaMock,
  emitToTenant: () => {},
});
const getOrCreateShopifyContact = await loadFunction("getOrCreateShopifyContact", {
  prisma: {
    shopifyCustomerMapping: {
      findFirst: async () => {
        throw new Error("lookup should not run without a customer ID");
      },
    },
  },
});

test("Shopify inbox messages persist the customer ID as a string", async () => {
  await saveShopifyInboxMessage({
    tenantId: "tenant-1",
    storeId: "store-1",
    shopifyCustomerId: 12345,
    conversation: { id: "conversation-1" },
    contact: { id: "contact-1" },
    messageText: "Order update",
    orderRecord: null,
  });

  assert.equal(state.messageData.source, "SHOPIFY");
  assert.equal(state.messageData.shopifyStoreId, "store-1");
  assert.equal(state.messageData.shopifyCustomerId, "12345");
});

test("missing customer ID is stored as null without changing message fields", async () => {
  state.messageData = null;
  state.conversationUpdateCalls = 0;
  await saveShopifyInboxMessage({
    tenantId: "tenant-1",
    storeId: "store-1",
    conversation: { id: "conversation-1" },
    contact: { id: "contact-1" },
    messageText: "Order update",
    orderRecord: null,
  });

  assert.equal(state.messageData.shopifyCustomerId, null);
  assert.equal(state.messageData.text, "Order update");
  assert.equal(state.messageData.senderType, "SYSTEM");
  assert.equal(state.messageData.direction, "OUTBOUND");
  assert.equal(state.conversationUpdateCalls, 1);
});

test("missing customer ID keeps Shopify contact lookup behavior unchanged", async () => {
  const result = await getOrCreateShopifyContact({
    tenantId: "tenant-1",
    storeId: "store-1",
    shopifyCustomerId: null,
    customerPhone: "+15550000000",
    customerName: "Customer",
    customerEmail: "",
  });

  assert.deepEqual(result, { contact: null, conversation: null });
});

test("all Shopify save callsites pass the in-scope customer ID", async () => {
  const files = [
    {
      path: "./shopify.orderLifecycle.js",
      count: 10,
      expressions: [
        ["shopifyCustomerId: currentOrder.shopifyCustomerId", 1],
        ["shopifyCustomerId: customerObj?.id", 8],
        ["shopifyCustomerId: custId", 1],
      ],
    },
    {
      path: "./shopify.cartRecovery.service.js",
      count: 1,
      expressions: [["shopifyCustomerId,", 1]],
    },
    {
      path: "./shopify.postPurchase.service.js",
      count: 5,
      expressions: [["shopifyCustomerId: order.shopifyCustomerId", 5]],
    },
  ];

  for (const file of files) {
    const source = await readFile(new URL(file.path, import.meta.url), "utf8");
    const calls = [...source.matchAll(/saveShopifyInboxMessage\(\{([\s\S]*?)\}\);/g)];

    assert.equal(calls.length, file.count, `${file.path} callsite count`);
    for (const call of calls) {
      assert.match(
        call[1],
        /shopifyCustomerId\s*(?::|,)/,
        `${file.path} callsite attribution`,
      );
    }
    for (const [expression, count] of file.expressions) {
      const actual = calls.reduce(
        (total, call) => total + (call[1].split(expression).length - 1),
        0,
      );
      assert.equal(actual, count, `${file.path}: ${expression}`);
    }
  }
});

test("Shopify cart and post-purchase contact lookups pass existing IDs", async () => {
  const files = [
    { path: "./shopify.cartRecovery.service.js", expectedCalls: 1 },
    { path: "./shopify.postPurchase.service.js", expectedCalls: 5 },
  ];

  for (const file of files) {
    const source = await readFile(new URL(file.path, import.meta.url), "utf8");
    const calls = [...source.matchAll(/getOrCreateShopifyContact\(\{([\s\S]*?)\}\);/g)];

    assert.equal(calls.length, file.expectedCalls, `${file.path} helper count`);
    for (const call of calls) {
      assert.match(call[1], /\bstoreId\s*,/);
      assert.match(call[1], /shopifyCustomerId\s*(?::|,)/);
    }
  }
});

test("generic inbound message creation remains without Shopify attribution", async () => {
  const source = await readFile(
    new URL("../../messages/message.service.js", import.meta.url),
    "utf8",
  );
  const inboundCreate = source.match(
    /const createdMsg = await tx\.message\.create\(\{\s*data:\s*\{([\s\S]*?)\n\s*\},\s*\}\);/,
  );

  assert.ok(inboundCreate, "generic inbound message create remains present");
  assert.doesNotMatch(inboundCreate[1], /shopifyCustomerId|shopifyStoreId|source:/);
});

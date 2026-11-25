import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, mock, test } from "node:test";

const testSecret = "shopify-webhook-test-secret";
const rawBody = Buffer.from('{"id":123,"name":"#123"}');
const validPayload = { id: 123, name: "#123" };
const knownConnection = {
  tenantId: "test-tenant",
  store: {
    id: "test-store",
    tenantId: "test-tenant",
    shopDomain: "known-shop.myshopify.com",
    status: "active",
    redactedAt: null,
  },
};

const state = {
  connection: knownConnection,
  findFirstCalls: 0,
  queueCalls: [],
};

const prismaMock = {
  shopifyConnection: {
    findFirst: async () => {
      state.findFirstCalls += 1;
      return state.connection;
    },
  },
};

const queueMock = {
  add: async (...args) => {
    state.queueCalls.push(args);
    return { id: "mock-job" };
  },
};

const moduleMocks = [
  mock.module(new URL("../../../config/prisma.js", import.meta.url).href, {
    defaultExport: prismaMock,
  }),
  mock.module(
    new URL("../../../cron/queues/order-webhook.queue.js", import.meta.url)
      .href,
    { namedExports: { orderWebhookQueue: queueMock } },
  ),
  mock.module(
    new URL(
      "../products/shopify.backInStock.service.js",
      import.meta.url,
    ).href,
    { namedExports: { handleProductUpdateForBackInStock: async () => ({}) } },
  ),
  mock.module(
    new URL("../products/shopify.productSync.service.js", import.meta.url)
      .href,
    {
      namedExports: {
        upsertProduct: async () => ({}),
        markProductDeleted: async () => ({}),
      },
    },
  ),
];

const { handleIncomingWebhook } = await import(
  "./shopify.webhook.controller.js"
);

const originalSecret = process.env.SHOPIFY_API_SECRET;

function sign(body = rawBody, secret = testSecret) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

function makeRequest(options = {}) {
  const {
    body = validPayload,
    shop = "known-shop.myshopify.com",
    topic = "orders/updated",
  } = options;
  const signature = Object.hasOwn(options, "signature")
    ? options.signature
    : sign();
  const requestBody = Object.hasOwn(options, "requestBody")
    ? options.requestBody
    : rawBody;

  return {
    headers: {
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": shop,
      ...(signature === undefined
        ? {}
        : { "x-shopify-hmac-sha256": signature }),
    },
    body,
    rawBody: requestBody,
  };
}

function makeResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

async function invoke(options) {
  const response = makeResponse();
  await handleIncomingWebhook(makeRequest(options), response);
  return response;
}

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.SHOPIFY_API_SECRET;
  } else {
    process.env.SHOPIFY_API_SECRET = originalSecret;
  }

  state.connection = knownConnection;
  state.findFirstCalls = 0;
  state.queueCalls.length = 0;

  // Restore Node's module-mock registrations after each case. The controller
  // retains the mocked dependency objects imported above for this test file.
  for (const moduleMock of moduleMocks) moduleMock.restore();
});

test("valid Shopify HMAC is accepted and queues one job", async () => {
  process.env.SHOPIFY_API_SECRET = testSecret;

  const response = await invoke();

  assert.equal(response.statusCode, 200);
  assert.equal(state.findFirstCalls, 1);
  assert.equal(state.queueCalls.length, 1);
});

test("invalid Shopify HMAC returns HTTP 401", async () => {
  process.env.SHOPIFY_API_SECRET = testSecret;

  const response = await invoke({
    signature: sign(Buffer.from('{"id":123,"name":"tampered"}')),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(state.findFirstCalls, 0);
  assert.equal(state.queueCalls.length, 0);
});

test("missing Shopify HMAC header returns HTTP 401", async () => {
  process.env.SHOPIFY_API_SECRET = testSecret;

  const response = await invoke({ signature: undefined });

  assert.equal(response.statusCode, 401);
  assert.equal(state.findFirstCalls, 0);
  assert.equal(state.queueCalls.length, 0);
});

test("missing rawBody returns HTTP 500", async () => {
  process.env.SHOPIFY_API_SECRET = testSecret;

  const response = await invoke({ requestBody: undefined });

  assert.equal(response.statusCode, 500);
  assert.equal(state.findFirstCalls, 0);
  assert.equal(state.queueCalls.length, 0);
});

test("missing SHOPIFY_API_SECRET returns HTTP 500", async () => {
  delete process.env.SHOPIFY_API_SECRET;

  const response = await invoke();

  assert.equal(response.statusCode, 500);
  assert.equal(state.findFirstCalls, 0);
  assert.equal(state.queueCalls.length, 0);
});

test("valid HMAC for an unknown shop returns HTTP 200 without queueing", async () => {
  process.env.SHOPIFY_API_SECRET = testSecret;
  state.connection = null;

  const response = await invoke({ shop: "unknown-shop.myshopify.com" });

  assert.equal(response.statusCode, 200);
  assert.equal(state.findFirstCalls, 1);
  assert.equal(state.queueCalls.length, 0);
});

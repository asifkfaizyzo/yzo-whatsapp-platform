
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const state = {
  dlqJobs: new Map(),
  orderQueueCalls: [],
  webhookQueueCalls: [],
  removedJobs: [],
};

const makeJob = (id, data) => ({
  id,
  data,
  timestamp: Date.now(),
  remove: async () => {
    state.removedJobs.push(id);
    state.dlqJobs.delete(id);
  },
});

const dlqQueueMock = {
  getJob: async (id) => state.dlqJobs.get(id) || null,
  getJobs: async () => [...state.dlqJobs.values()],
};

const orderWebhookQueueMock = {
  add: async (...args) => {
    state.orderQueueCalls.push(args);
    return { id: `order-job-${state.orderQueueCalls.length}` };
  },
};

const webhookQueueMock = {
  add: async (...args) => {
    state.webhookQueueCalls.push(args);
    return { id: `meta-job-${state.webhookQueueCalls.length}` };
  },
};

const moduleMocks = [
  mock.module(
    new URL("../../cron/queues/dlq.queue.js", import.meta.url).href,
    { namedExports: { dlqQueue: dlqQueueMock } },
  ),
  mock.module(
    new URL("../../cron/queues/webhook.queue.js", import.meta.url).href,
    { namedExports: { webhookQueue: webhookQueueMock } },
  ),
  mock.module(
    new URL("../../cron/queues/order-webhook.queue.js", import.meta.url).href,
    {
      namedExports: {
        orderWebhookQueue: orderWebhookQueueMock,
        QUEUE_NAME_ORDER_WEBHOOK: "order-webhook-events",
      },
    },
  ),
];

const {
  retryFailedWebhook,
  retryAllFailedWebhooks,
} = await import("./dlq.controller.js");

function resetState() {
  state.dlqJobs.clear();
  state.orderQueueCalls.length = 0;
  state.webhookQueueCalls.length = 0;
  state.removedJobs.length = 0;
}

function makeResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function addShopifyJob(id, name) {
  const job = makeJob(id, {
    originalQueue: "order-webhook-events",
    originalJobName: name,
    originalData: {
      tenantId: "tenant-1",
      storeId: "store-1",
      shopDomain: "shop.example",
    },
  });

  state.dlqJobs.set(id, job);
  return job;
}

test("single retry sends Shopify privacy job to order webhook queue", async () => {
  resetState();
  addShopifyJob("dlq-privacy", "shopify-privacy");

  const req = { params: { id: "dlq-privacy" } };
  const res = makeResponse();

  await retryFailedWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.orderQueueCalls.length, 1);
  assert.equal(state.orderQueueCalls[0][0], "shopify-privacy");
  assert.equal(state.orderQueueCalls[0][2].attempts, 5);
  assert.equal(state.webhookQueueCalls.length, 0);
  assert.deepEqual(state.removedJobs, ["dlq-privacy"]);
});

test("single retry sends Shopify customer export to order webhook queue", async () => {
  resetState();
  addShopifyJob("dlq-export", "shopify-customer-data-export");

  const req = { params: { id: "dlq-export" } };
  const res = makeResponse();

  await retryFailedWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.orderQueueCalls.length, 1);
  assert.equal(
    state.orderQueueCalls[0][0],
    "shopify-customer-data-export",
  );
  assert.equal(state.webhookQueueCalls.length, 0);
  assert.deepEqual(state.removedJobs, ["dlq-export"]);
});

test("single Meta retry preserves its existing queue and retry settings", async () => {
  resetState();

  const job = makeJob("dlq-meta", {
    originalQueue: "meta-webhook-events",
    originalJobName: "meta-webhook-payload",
    originalData: { event: "message.received" },
  });
  state.dlqJobs.set(job.id, job);

  const req = { params: { id: "dlq-meta" } };
  const res = makeResponse();

  await retryFailedWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.webhookQueueCalls.length, 1);
  assert.equal(state.webhookQueueCalls[0][0], "meta-webhook-payload");
  assert.equal(state.webhookQueueCalls[0][2].attempts, 3);
  assert.equal(state.orderQueueCalls.length, 0);
  assert.deepEqual(state.removedJobs, ["dlq-meta"]);
});

test("bulk retry routes Shopify jobs and Meta jobs to their correct queues", async () => {
  resetState();

  addShopifyJob("dlq-privacy", "shopify-privacy");
  addShopifyJob("dlq-export", "shopify-customer-data-export");

  const metaJob = makeJob("dlq-meta", {
    originalQueue: "meta-webhook-events",
    originalJobName: "meta-webhook-payload",
    originalData: { event: "message.received" },
  });
  state.dlqJobs.set(metaJob.id, metaJob);

  const req = {};
  const res = makeResponse();

  await retryAllFailedWebhooks(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.retriedCount, 3);
  assert.equal(state.orderQueueCalls.length, 2);
  assert.equal(state.webhookQueueCalls.length, 1);
  assert.equal(state.removedJobs.length, 3);
});

test("failed Shopify queue insertion leaves the DLQ job intact", async () => {
  resetState();
  addShopifyJob("dlq-privacy", "shopify-privacy");

  orderWebhookQueueMock.add = async () => {
    throw new Error("Queue unavailable");
  };

  const req = { params: { id: "dlq-privacy" } };
  const res = makeResponse();

  await retryFailedWebhook(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(state.removedJobs.length, 0);
  assert.equal(state.dlqJobs.has("dlq-privacy"), true);

  orderWebhookQueueMock.add = async (...args) => {
    state.orderQueueCalls.push(args);
    return { id: `order-job-${state.orderQueueCalls.length}` };
  };
});

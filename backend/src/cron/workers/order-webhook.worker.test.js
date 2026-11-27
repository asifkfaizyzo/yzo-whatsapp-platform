
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const state = {
  failedHandler: null,
  dlqCalls: [],
  dlqFailuresRemaining: 0,
};

mock.module("bullmq", {
  namedExports: {
    Worker: class {
      constructor(queueName, processor, options) {
        this.queueName = queueName;
        this.processor = processor;
        this.options = options;
      }

      on(event, handler) {
        if (event === "failed") {
          state.failedHandler = handler;
        }
      }
    },
  },
});

mock.module("../queues/order-webhook.queue.js", {
  namedExports: {
    QUEUE_NAME_ORDER_WEBHOOK: "order-webhook-events",
  },
});

mock.module("../../config/redis.js", {
  namedExports: {
    redisConnection: {},
  },
});

mock.module("../../modules/webhook/order.webhook.controller.js", {
  namedExports: {
    processOrderWebhookJob: async () => ({}),
  },
});

mock.module("../queues/dlq.queue.js", {
  namedExports: {
    dlqQueue: {
      add: async (name, data, options) => {
        state.dlqCalls.push({ name, data, options });

        if (state.dlqFailuresRemaining > 0) {
          state.dlqFailuresRemaining--;
          throw new Error("DLQ unavailable");
        }

        return { id: options.jobId };
      },
    },
  },
});

const { startOrderWebhookWorker } = await import(
  "./order-webhook.worker.js"
);

const worker = startOrderWebhookWorker();

const createJob = (name) => ({
  id: "job-123",
  name,
  data: {
    tenantId: "tenant-1",
    storeId: "store-1",
    shopifyCustomerId: "customer-123",
  },
  attemptsMade: 5,
  opts: { attempts: 5 },
  processedOn: Date.now() - 1000,
});

const invokeFailedHandler = async (name) => {
  await state.failedHandler(
    createJob(name),
    new Error("Processing failed"),
  );
};

test("Shopify privacy job enters DLQ on first successful insertion", async () => {
  state.dlqCalls = [];
  state.dlqFailuresRemaining = 0;

  await invokeFailedHandler("shopify-privacy");

  assert.equal(state.dlqCalls.length, 1);
  assert.equal(
    state.dlqCalls[0].options.jobId,
    "dlq_shopify_job-123",
  );
});

test("Shopify privacy job retries DLQ insertion and succeeds on second attempt", async () => {
  state.dlqCalls = [];
  state.dlqFailuresRemaining = 1;

  await invokeFailedHandler("shopify-privacy");

  assert.equal(state.dlqCalls.length, 2);
  assert.equal(
    state.dlqCalls[0].options.jobId,
    state.dlqCalls[1].options.jobId,
  );
});

test("Shopify privacy job stops after three failed DLQ insertions", async () => {
  state.dlqCalls = [];
  state.dlqFailuresRemaining = 3;

  await invokeFailedHandler("shopify-privacy");

  assert.equal(state.dlqCalls.length, 3);
});

test("Shopify customer export job uses the same three-attempt recovery", async () => {
  state.dlqCalls = [];
  state.dlqFailuresRemaining = 2;

  await invokeFailedHandler("shopify-customer-data-export");

  assert.equal(state.dlqCalls.length, 3);
  assert.equal(
    state.dlqCalls[0].options.jobId,
    "dlq_shopify_job-123",
  );
});

test("Non-Shopify jobs preserve their original single-attempt DLQ behaviour", async () => {
  state.dlqCalls = [];
  state.dlqFailuresRemaining = 0;

  await invokeFailedHandler("woocommerce-cart-event");

  assert.equal(state.dlqCalls.length, 1);
  assert.match(
    state.dlqCalls[0].options.jobId,
    /^dlq_order_rzp_job-123_/,
  );
});

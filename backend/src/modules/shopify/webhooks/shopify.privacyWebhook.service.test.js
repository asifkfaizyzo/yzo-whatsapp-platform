import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const serviceSource = await readFile(new URL("./shopify.privacyWebhook.service.js", import.meta.url), "utf8");

function createHarness({
  storeExists = true,
  failCleanup = false,
  queueJobs = [],
  dlqJobs = [],
  failQueueCleanup = false,
} = {}) {
  const state = {
    tombstones: new Map(),
    operations: [],
    deleted: [],
    exports: [],
    failCleanup,
    failQueueCleanup,
    queueJobs,
    dlqJobs,
    sharedRecords: {
      contacts: [{ id: "shared-contact" }],
      conversations: [{ id: "shared-conversation" }],
      whatsappMessages: [{ id: "whatsapp-message", source: "WHATSAPP" }],
      otherStoreOrders: [{ id: "other-store-order", shopifyStoreId: "store-2" }],
    },
  };

  const store = {
    id: "store-1",
    tenantId: "tenant-1",
    shopDomain: "shop.example",
    status: "active",
    redactedAt: null,
  };

  const matches = (record, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "storeId_webhookId") {
        return (
          record.storeId === value.storeId &&
          record.webhookId === value.webhookId
        );
      }

      if (value && typeof value === "object" && "not" in value) {
        return record[key] !== value.not;
      }

      return record[key] === value;
    });

  const prisma = {
    shopifyStore: {
      findFirst: async (args) => {
        state.operations.push(["store.findFirst", args]);

        return storeExists &&
          args.where.id === store.id &&
          args.where.tenantId === store.tenantId &&
          args.where.shopDomain === store.shopDomain
          ? store
          : null;
      },

      updateMany: async ({ where, data }) => {
        state.operations.push(["store.updateMany", { where, data }]);

        if (
          where.id !== store.id ||
          where.tenantId !== store.tenantId ||
          where.shopDomain !== store.shopDomain
        ) {
          return { count: 0 };
        }

        Object.assign(store, data);
        return { count: 1 };
      },
    },

    shopifyCustomerRedaction: {
      create: async ({ data }) => {
        state.operations.push(["redaction.create", data]);

        const key = `${data.storeId}:${data.shopifyCustomerId}`;

        if (state.tombstones.has(key)) {
          const error = new Error("unique constraint");
          error.code = "P2002";
          throw error;
        }

        state.tombstones.set(key, { ...data });
        return data;
      },

      findUnique: async ({ where }) =>
        state.tombstones.get(
          `${where.storeId_shopifyCustomerId.storeId}:${where.storeId_shopifyCustomerId.shopifyCustomerId}`,
        ) ?? null,
    },

    shopifyCustomerDataExport: {
      create: async ({ data }) => {
        state.operations.push(["export.create", data]);

        const duplicate = state.exports.find(
          (record) =>
            record.storeId === data.storeId &&
            record.webhookId === data.webhookId,
        );

        if (duplicate) {
          const error = new Error("unique constraint");
          error.code = "P2002";
          throw error;
        }

        const record = {
          id: `export-${state.exports.length + 1}`,
          ...data,
          filePath: null,
          downloadTokenHash: null,
          expiresAt: null,
          downloadedAt: null,
          generatedAt: null,
          failureReason: null,
        };

        state.exports.push(record);

        return { id: record.id };
      },

      findUnique: async ({ where }) => {
        state.operations.push(["export.findUnique", where]);

        if (where.storeId_webhookId) {
          return state.exports.find(
            (record) =>
              record.storeId === where.storeId_webhookId.storeId &&
              record.webhookId === where.storeId_webhookId.webhookId,
          ) ?? null;
        }

        return null;
      },

      findMany: async ({ where }) =>
        state.exports.filter((record) => matches(record, where)),

      updateMany: async ({ where, data }) => {
        state.operations.push(["export.updateMany", { where, data }]);

        const records = state.exports.filter((record) =>
          matches(record, where),
        );

        for (const record of records) {
          Object.assign(record, data);
        }

        return { count: records.length };
      },
    },

    $transaction: async (callback) => {
      state.operations.push(["transaction.begin"]);

      const tx = {};
      const stagedDeletes = [];

      for (const model of [
        "shopifyCustomerMapping",
        "ecommerceOrder",
        "message",
        "contactProviderMapping",
        "shopifyConnection",
        "webhookEvent",
      ]) {
        tx[model] = {
          deleteMany: async ({ where }) => {
            state.operations.push([`${model}.deleteMany`, where]);
            stagedDeletes.push({ model, where });

            if (state.failCleanup) {
              throw new Error("database error");
            }

            return { count: 1 };
          },
        };
      }

      const result = await callback(tx);
      state.deleted.push(...stagedDeletes);

      return result;
    },
  };

  const makeJob = (data) => ({
    ...data,
    state: data.state ?? "waiting",

    getState: async function () {
      return this.state;
    },

    remove: async function () {
      this.removed = true;
    },
  });

  state.queueJobs = queueJobs.map(makeJob);
  state.dlqJobs = dlqJobs.map(makeJob);

  const makeQueue = (jobs) => ({
    getJobs: async (states, start, end) => {
      if (state.failQueueCleanup) {
        throw new Error("queue error");
      }

      return jobs
        .filter(
          (job) =>
            !job.removed && states.includes(job.state ?? "waiting"),
        )
        .slice(start, end + 1);
    },
  });

  const orderWebhookQueue = makeQueue(state.queueJobs);
  const dlqQueue = makeQueue(state.dlqJobs);

  orderWebhookQueue.add = async (name, data, options = {}) => {
    state.operations.push(["queue.add", { name, data, options }]);

    const existing = state.queueJobs.find(
      (job) => job.id === options.jobId && !job.removed,
    );

    if (existing) {
      return existing;
    }

    const job = makeJob({
      id: options.jobId,
      name,
      data,
    });

    state.queueJobs.push(job);

    return job;
  };

  const executable = serviceSource
    .replace(/^import .*;\s*/gm, "")
    .replace(
      "export const processShopifyPrivacyWebhook",
      "const processShopifyPrivacyWebhook",
    );

  const processShopifyPrivacyWebhook = new Function(
    "prisma",
    "orderWebhookQueue",
    "dlqQueue",
    `${executable}; return processShopifyPrivacyWebhook;`,
  )(prisma, orderWebhookQueue, dlqQueue);

  return {
    processShopifyPrivacyWebhook,
    state,
    store,
  };
}


const request = {
  topic: "customers/redact",
  tenantId: "tenant-1",
  storeId: "store-1",
  shopDomain: "SHOP.EXAMPLE",
  customerId: "customer-1",
};

const shopRedactRequest = {
  ...request,
  topic: "shop/redact",
  customerId: null,
};

test("deletes only the exact store/customer Shopify records", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();
  const result = await processShopifyPrivacyWebhook(request);

  assert.equal(result.status, "redacted");
  assert.deepEqual(state.deleted, [
    { model: "shopifyCustomerMapping", where: { tenantId: "tenant-1", storeId: "store-1", shopifyCustomerId: "customer-1" } },
    { model: "ecommerceOrder", where: { tenantId: "tenant-1", source: "SHOPIFY", shopifyStoreId: "store-1", shopifyCustomerId: "customer-1" } },
    { model: "message", where: { source: "SHOPIFY", shopifyStoreId: "store-1", shopifyCustomerId: "customer-1" } },
  ]);
  assert.equal(state.tombstones.size, 1);
  assert.ok(state.operations.findIndex(([name]) => name === "redaction.create") <
    state.operations.findIndex(([name]) => name === "transaction.begin"));
});

test("repeated request is idempotent and retries scoped cleanup", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();
  assert.equal((await processShopifyPrivacyWebhook(request)).status, "redacted");
  const repeated = await processShopifyPrivacyWebhook(request);

  assert.equal(repeated.status, "repeated");
  assert.equal(state.tombstones.size, 1);
  assert.equal(state.deleted.length, 6);
});

test("preserves shared contacts, conversations, WhatsApp messages, and unrelated data", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();
  await processShopifyPrivacyWebhook(request);

  assert.deepEqual(state.deleted.map(({ model }) => model), [
  "shopifyCustomerMapping",
  "ecommerceOrder",
  "message",
]);
  assert.equal(state.deleted[2].where.source, "SHOPIFY");
  assert.equal(state.deleted[2].where.shopifyStoreId, "store-1");
  assert.equal(state.deleted[2].where.shopifyCustomerId, "customer-1");
});

test("invalid identity is rejected before tombstone or cleanup", async () => {
  const missing = createHarness();
  assert.equal((await missing.processShopifyPrivacyWebhook({ ...request, customerId: " " })).status, "invalid");
  assert.equal(missing.state.tombstones.size, 0);
  assert.equal(missing.state.deleted.length, 0);

  const mismatch = createHarness({ storeExists: false });
  assert.equal((await mismatch.processShopifyPrivacyWebhook(request)).reason, "store_identity_mismatch");
  assert.equal(mismatch.state.tombstones.size, 0);
  assert.equal(mismatch.state.deleted.length, 0);
});

test("cleanup failure leaves tombstone and a repeated attempt can finish cleanup", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness({ failCleanup: true });
  await assert.rejects(processShopifyPrivacyWebhook(request), {
    message: "Shopify customer redaction cleanup failed; tombstone retained",
  });
  assert.equal(state.tombstones.size, 1);
  assert.equal(state.deleted.length, 0);
  assert.equal(state.operations[0][0], "store.findFirst");

  state.failCleanup = false;
  const retry = await processShopifyPrivacyWebhook(request);
  assert.equal(retry.status, "repeated");
  assert.equal(state.tombstones.size, 1);
});

test("shop redact marks the store and deletes only exact store-owned records", async () => {
  const { processShopifyPrivacyWebhook, state, store } = createHarness();
  state.tombstones.set("store-1:customer-redaction", {
    storeId: "store-1",
    shopifyCustomerId: "customer-redaction",
  });

  const result = await processShopifyPrivacyWebhook(shopRedactRequest);

  assert.equal(result.status, "redacted");
  assert.equal(store.status, "redacted");
  assert.ok(store.redactedAt instanceof Date);
  assert.deepEqual(state.deleted, [
    { model: "shopifyConnection", where: { tenantId: "tenant-1", storeId: "store-1" } },
    { model: "ecommerceOrder", where: { tenantId: "tenant-1", source: "SHOPIFY", shopifyStoreId: "store-1" } },
    { model: "message", where: { source: "SHOPIFY", shopifyStoreId: "store-1" } },
    { model: "shopifyCustomerMapping", where: { tenantId: "tenant-1", storeId: "store-1" } },
    { model: "webhookEvent", where: { tenantId: "tenant-1", provider: "SHOPIFY", eventId: { startsWith: "shopify:store-1:" } } },
  ]);
  assert.equal(state.tombstones.size, 1);
  assert.ok(
    state.operations.findIndex(([name]) => name === "store.updateMany") <
      state.operations.findIndex(([name]) => name === "transaction.begin"),
  );
});

test("repeated shop redact request reruns cleanup without changing the original marker", async () => {
  const { processShopifyPrivacyWebhook, state, store } = createHarness();
  assert.equal((await processShopifyPrivacyWebhook(shopRedactRequest)).status, "redacted");
  const firstRedactedAt = store.redactedAt;

  const repeated = await processShopifyPrivacyWebhook(shopRedactRequest);

  assert.equal(repeated.status, "repeated");
  assert.equal(store.status, "redacted");
  assert.equal(store.redactedAt, firstRedactedAt);
  assert.equal(state.deleted.length, 10);
});

test("shop redaction rejects a tenant or store identity mismatch before mutation", async () => {
  const { processShopifyPrivacyWebhook, state, store } = createHarness();

  const wrongTenant = await processShopifyPrivacyWebhook({
    ...shopRedactRequest,
    tenantId: "tenant-2",
  });
  const wrongStore = await processShopifyPrivacyWebhook({
    ...shopRedactRequest,
    storeId: "store-2",
  });

  assert.equal(wrongTenant.reason, "store_identity_mismatch");
  assert.equal(wrongStore.reason, "store_identity_mismatch");
  assert.equal(store.status, "active");
  assert.equal(store.redactedAt, null);
  assert.equal(state.deleted.length, 0);
});

test("shop redaction retains shared contacts, conversations, WhatsApp and other-store rows", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();
  const before = structuredClone(state.sharedRecords);

  await processShopifyPrivacyWebhook(shopRedactRequest);

  assert.deepEqual(state.sharedRecords, before);
  assert.equal(
    state.deleted.some(({ model }) => ["contact", "conversation", "contactProviderMapping"].includes(model)),
    false,
  );
  const messageDelete = state.deleted.find(({ model }) => model === "message");
  assert.deepEqual(messageDelete.where, {
    source: "SHOPIFY",
    shopifyStoreId: "store-1",
  });
});

test("shop cleanup failure retains the redacted marker and a retry completes cleanup", async () => {
  const { processShopifyPrivacyWebhook, state, store } = createHarness({ failCleanup: true });
  await assert.rejects(processShopifyPrivacyWebhook(shopRedactRequest), {
    message: "Shopify store redaction cleanup failed; store remains redacted",
  });
  assert.equal(store.status, "redacted");
  assert.ok(store.redactedAt instanceof Date);
  assert.equal(state.deleted.length, 0);

  state.failCleanup = false;
  const retry = await processShopifyPrivacyWebhook(shopRedactRequest);
  assert.equal(retry.status, "repeated");
  assert.equal(state.deleted.length, 5);
});

test("shop redaction removes only allowlisted jobs for the exact store", async () => {
  const queueJobs = [
    { id: "match", name: "shopify-order", data: { storeId: "store-1" } },
    { id: "other-store", name: "shopify-order", data: { storeId: "store-2" } },
    { id: "whatsapp", name: "whatsapp-webhook", data: { storeId: "store-1" } },
    { id: "meta", name: "meta-webhook-payload", data: { storeId: "store-1" } },
    { id: "woocommerce", name: "woocommerce-order", data: { storeId: "store-1" } },
    { id: "missing-store", name: "shopify-privacy", data: {} },
    { id: "active", name: "shopify-payment-reminder", data: { storeId: "store-1" }, state: "active" },
  ];
  const { processShopifyPrivacyWebhook, state } = createHarness({ queueJobs });
  await processShopifyPrivacyWebhook(shopRedactRequest);
  assert.deepEqual(state.queueJobs.filter((job) => job.removed).map((job) => job.id), ["match"]);
});

test("shop redaction removes only matching Shopify DLQ records", async () => {
  const dlqJobs = [
    { id: "match", data: { originalQueue: "order-webhook-events", originalJobName: "shopify-order", originalData: { storeId: "store-1" } } },
    { id: "other-store", data: { originalQueue: "order-webhook-events", originalJobName: "shopify-order", originalData: { storeId: "store-2" } } },
    { id: "wrong-queue", data: { originalQueue: "webhook-events", originalJobName: "shopify-order", originalData: { storeId: "store-1" } } },
    { id: "whatsapp", data: { originalQueue: "order-webhook-events", originalJobName: "whatsapp-webhook", originalData: { storeId: "store-1" } } },
    { id: "missing-store", data: { originalQueue: "order-webhook-events", originalJobName: "shopify-order", originalData: {} } },
  ];
  const { processShopifyPrivacyWebhook, state } = createHarness({ dlqJobs });
  await processShopifyPrivacyWebhook(shopRedactRequest);
  assert.deepEqual(state.dlqJobs.filter((job) => job.removed).map((job) => job.id), ["match"]);
});

test("queue cleanup is safe to repeat and failures are reported for retry", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness({
    queueJobs: [{ id: "match", name: "shopify-order", data: { storeId: "store-1" } }],
  });
  await processShopifyPrivacyWebhook(shopRedactRequest);
  const repeated = await processShopifyPrivacyWebhook(shopRedactRequest);
  assert.equal(repeated.status, "repeated");
  assert.equal(state.queueJobs.filter((job) => job.removed).length, 1);

  const failed = createHarness({ failQueueCleanup: true });
  await assert.rejects(failed.processShopifyPrivacyWebhook(shopRedactRequest), {
    message: "Shopify store redaction cleanup failed; store remains redacted",
  });
  assert.equal(failed.store.status, "redacted");
  failed.state.failQueueCleanup = false;
  assert.equal((await failed.processShopifyPrivacyWebhook(shopRedactRequest)).status, "repeated");
});

test("customers/data_request creates and queues a customer export", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();

  const result = await processShopifyPrivacyWebhook({
    ...request,
    topic: "customers/data_request",
    webhookId: "webhook-1",
  });

  assert.equal(state.exports.length, 1);
  assert.equal(state.exports[0].webhookId, "webhook-1");
  assert.equal(state.exports[0].shopifyCustomerId, "customer-1");

  const queuedJob = state.queueJobs.find(
    (job) => job.name === "shopify-customer-data-export",
  );

  assert.ok(queuedJob);
  assert.equal(queuedJob.data.exportId, state.exports[0].id);
  assert.equal(queuedJob.data.tenantId, "tenant-1");
  assert.equal(queuedJob.data.storeId, "store-1");
  assert.notEqual(result.status, "invalid");
});

test("repeated customers/data_request webhook reuses the existing export", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();

  const dataRequest = {
    ...request,
    topic: "customers/data_request",
    webhookId: "webhook-duplicate",
  };

  await processShopifyPrivacyWebhook(dataRequest);
  await processShopifyPrivacyWebhook(dataRequest);

  assert.equal(state.exports.length, 1);

  const exportJobs = state.queueJobs.filter(
    (job) => job.name === "shopify-customer-data-export",
  );

  assert.equal(exportJobs.length, 1);
  assert.equal(exportJobs[0].data.exportId, state.exports[0].id);
});

test("customers/data_request is rejected after customer redaction", async () => {
  const { processShopifyPrivacyWebhook, state } = createHarness();

  state.tombstones.set("store-1:customer-1", {
    tenantId: "tenant-1",
    storeId: "store-1",
    shopifyCustomerId: "customer-1",
  });

  const result = await processShopifyPrivacyWebhook({
    ...request,
    topic: "customers/data_request",
    webhookId: "webhook-after-redaction",
  });

  assert.equal(state.exports.length, 0);

  assert.equal(
    state.queueJobs.some(
      (job) => job.name === "shopify-customer-data-export",
    ),
    false,
  );

  assert.notEqual(result.status, "queued");
});

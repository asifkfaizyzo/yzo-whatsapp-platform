import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import crypto from "node:crypto";
import path from "node:path";

const serviceSource = await readFile(
  new URL("./shopify.customerDataExport.service.js", import.meta.url),
  "utf8",
);

function createHarness({
  status = "PENDING",
  redacted = false,
  storeActive = true,
  failShopify = false,
  redactDuringProcessing = false,
} = {}) {
  const state = {
    exports: [],
    redaction: redacted ? { id: "redaction-1" } : null,
    operations: [],
    files: new Map(),
    audits: [],
    apiCalls: [],
    orders: [{ id: "shopify-order-1" }],
    localOrders: [{ id: "local-order-1" }],
    messages: [{ id: "shopify-message-1" }],
    renameFails: false,
  };

  const exportRecord = {
    id: "export-1",
    tenantId: "tenant-1",
    storeId: "store-1",
    shopifyCustomerId: "customer-1",
    webhookId: "webhook-1",
    status,
    processingStartedAt:
    status === "PROCESSING" ? new Date(Date.now() - 10 * 1000) : null,
    createdAt: new Date("2026-11-24T00:00:00.000Z"),
    filePath: null,
    expiresAt: null,
    generatedAt: null,
    downloadedAt: null,
    failureReason: null,
  };

  state.exports.push(exportRecord);

  const store = {
    id: "store-1",
    tenantId: "tenant-1",
    shopDomain: "shop.example",
    redactedAt: null,
  };

   const matches = (record, where = {}) => {
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") {
        return value.some((condition) => matches(record, condition));
      }

      if (value && typeof value === "object" && value instanceof Date === false) {
        if ("not" in value && record[key] === value.not) return false;
        if ("in" in value && !value.in.includes(record[key])) return false;

        if ("lt" in value) {
          if (!record[key] || new Date(record[key]) >= value.lt) return false;
        }

        return true;
      }

      return record[key] === value;
    });
  };

  const prisma = {
    shopifyCustomerDataExport: {
      findFirst: async ({ where }) => {
        state.operations.push(["export.findFirst", where]);

        return state.exports.find((record) => matches(record, where)) ?? null;
      },

      updateMany: async ({ where, data }) => {
        state.operations.push(["export.updateMany", { where, data }]);

        const records = state.exports.filter((record) =>
          matches(record, where),
        );

        records.forEach((record) => Object.assign(record, data));

        return { count: records.length };
      },
    },

    shopifyCustomerRedaction: {
      findFirst: async ({ where }) => {
        state.operations.push(["redaction.findFirst", where]);

        return state.redaction;
      },
    },

    shopifyStore: {
      findFirst: async ({ where }) => {
        state.operations.push(["store.findFirst", where]);

        if (
          !storeActive ||
          where.id !== store.id ||
          where.tenantId !== store.tenantId ||
          where.shopDomain !== store.shopDomain ||
          store.redactedAt !== null
        ) {
          return null;
        }

        return {
          id: store.id,
          tenantId: store.tenantId,
          shopDomain: store.shopDomain,
        };
      },
    },

    ecommerceOrder: {
      findMany: async ({ where }) => {
        state.operations.push(["orders.findMany", where]);
        return state.localOrders;
      },
    },

    message: {
      findMany: async ({ where }) => {
        state.operations.push(["messages.findMany", where]);
        return state.messages;
      },
    },
  };

  prisma.$transaction = async (callback) => callback(prisma);

  const axios = {
    get: async (url, options) => {
      state.apiCalls.push({ url, options });

      if (failShopify) {
        throw new Error("Shopify API request failed");
      }

      if (url.includes("/customers/")) {
        return {
          data: {
            customer: {
              id: "customer-1",
              email: "customer@example.com",
            },
          },
          headers: {},
        };
      }

            if (url.includes("/orders.json")) {
        if (redactDuringProcessing) {
          state.redaction = { id: "redaction-during-processing" };
        }

        return {
          data: {
            orders: state.orders,
          },
          headers: {},
        };
      }

      throw new Error(`Unexpected Shopify API URL: ${url}`);
    },
  };

  const fs = {
  mkdir: async () => {},

  writeFile: async (filePath, content) => {
    state.files.set(filePath, content);
  },

  rename: async (temporaryPath, finalPath) => {
    if (state.renameFails) {
      throw new Error("Simulated rename failure");
    }

    const content = state.files.get(temporaryPath);

    if (content === undefined) {
      throw new Error("Temporary export file not found");
    }

    state.files.delete(temporaryPath);
    state.files.set(finalPath, content);
  },

  unlink: async (filePath) => {
    state.files.delete(filePath);
  },
};

  const getShopifyAccessToken = async (tenantId) => {
    assert.equal(tenantId, "tenant-1");
    return "mock-access-token";
  };

  const createAuditLog = async (data) => {
    state.audits.push(data);
  };

  const executable = serviceSource
    .replace(/^import .*;\s*/gm, "")
    .replace(
      "export const processShopifyCustomerDataExport",
      "const processShopifyCustomerDataExport",
    );

  const processShopifyCustomerDataExport = new Function(
    "axios",
    "crypto",
    "fs",
    "path",
    "prisma",
    "getShopifyAccessToken",
    "createAuditLog",
    `${executable}; return processShopifyCustomerDataExport;`,
  )(axios, crypto, fs, path, prisma, getShopifyAccessToken, createAuditLog);

  return {
    processShopifyCustomerDataExport,
    state,
    exportRecord,
  };
}

const jobData = {
  exportId: "export-1",
  tenantId: "tenant-1",
  storeId: "store-1",
  shopifyCustomerId: "customer-1",
  shopDomain: "shop.example",
};

test("generates a customer export successfully", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness();

  const result = await processShopifyCustomerDataExport(jobData);

  assert.equal(result.success, true);
  assert.equal(result.exportId, "export-1");
  assert.equal(exportRecord.status, "COMPLETED");
  assert.ok(exportRecord.filePath);
  assert.ok(exportRecord.expiresAt instanceof Date);
  assert.equal(state.files.size, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(
    state.audits[0].action,
    "SHOPIFY_CUSTOMER_DATA_EXPORT_GENERATED",
  );
});

test("export contains only the requested customer's Shopify data", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness();

  await processShopifyCustomerDataExport(jobData);

  const contents = JSON.parse(state.files.get(exportRecord.filePath));

  assert.equal(contents.customer.id, "customer-1");
  assert.equal(contents.exportInformation.shopDomain, "shop.example");
  assert.deepEqual(contents.shopifyOrders, state.orders);
  assert.deepEqual(contents.sudoreplyOrders, state.localOrders);
  assert.deepEqual(contents.shopifyMessages, state.messages);
});

test("rejects an export with incorrect ownership", async () => {
  const { processShopifyCustomerDataExport, state } = createHarness();

  await assert.rejects(
    processShopifyCustomerDataExport({
      ...jobData,
      tenantId: "tenant-2",
    }),
    /not found or ownership validation failed/,
  );

  assert.equal(state.apiCalls.length, 0);
  assert.equal(state.files.size, 0);
});

test("skips an export when the customer is already redacted", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness({ redacted: true });

  const result = await processShopifyCustomerDataExport(jobData);

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "customer_redacted");
  assert.equal(exportRecord.status, "REDACTED");
  assert.equal(state.apiCalls.length, 0);
  assert.equal(state.files.size, 0);
});

test("stops export when customer is redacted during processing", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness({ redactDuringProcessing: true });

  const result = await processShopifyCustomerDataExport(jobData);

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "customer_redacted");
  assert.equal(exportRecord.status, "REDACTED");
  assert.equal(state.files.size, 0);
});

test("rejects an export when the Shopify store is inactive", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness({ storeActive: false });

  await assert.rejects(
    processShopifyCustomerDataExport(jobData),
    /not found, inactive, or already redacted/,
  );

  assert.equal(exportRecord.status, "FAILED");
  assert.equal(state.apiCalls.length, 0);
  assert.equal(state.files.size, 0);
});

test("skips an export already being processed by another worker", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness({ status: "PROCESSING" });

  const result = await processShopifyCustomerDataExport(jobData);

  assert.equal(result.skipped, true);
  assert.equal(
  result.reason,
  "export_already_processing_or_no_longer_active",
);
  assert.equal(exportRecord.status, "PROCESSING");
  assert.equal(state.apiCalls.length, 0);
  assert.equal(state.files.size, 0);
});

test("does not process an already completed export again", async () => {
  const { processShopifyCustomerDataExport, state } = createHarness({
    status: "COMPLETED",
  });

  const result = await processShopifyCustomerDataExport(jobData);

  assert.equal(result.alreadyCompleted, true);
  assert.equal(result.exportId, "export-1");
  assert.equal(state.apiCalls.length, 0);
  assert.equal(state.files.size, 0);
});

test("marks the export as failed when Shopify API fails", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness({ failShopify: true });

  await assert.rejects(
    processShopifyCustomerDataExport(jobData),
    /Shopify API request failed/,
  );

  assert.equal(exportRecord.status, "FAILED");
  assert.equal(exportRecord.filePath, null);
  assert.match(exportRecord.failureReason, /Shopify API request failed/);
  assert.equal(state.files.size, 0);
});


test("removes the temporary file when export rename fails", async () => {
  const { processShopifyCustomerDataExport, state, exportRecord } =
    createHarness();

  state.renameFails = true;

  await assert.rejects(
    processShopifyCustomerDataExport(jobData),
    /Simulated rename failure/,
  );

  assert.equal(exportRecord.status, "FAILED");
  assert.equal(exportRecord.filePath, null);
  assert.match(exportRecord.failureReason, /Simulated rename failure/);
  assert.equal(state.files.size, 0);
});
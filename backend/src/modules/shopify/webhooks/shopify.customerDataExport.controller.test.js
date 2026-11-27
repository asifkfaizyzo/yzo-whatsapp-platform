
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";

const controllerSource = await readFile(
  new URL("./shopify.customerDataExport.controller.js", import.meta.url),
  "utf8",
);

function createHarness({
  status = "COMPLETED",
  downloadedAt = null,
  expired = false,
  redacted = false,
  wrongTenant = false,
  missingFile = false,
} = {}) {
  const now = new Date();

  const state = {
    audits: [],
    fileReads: [],
    fileExists: !missingFile,
    sentFile: null,
    responseStatus: null,
    responseJson: null,
    responseHeaders: {},
    transactionCalls: 0,
    streamError: null,
  };

  const exportRecord = {
    id: "export-1",
    tenantId: "tenant-1",
    storeId: "store-1",
    shopifyCustomerId: "customer-1",
    status,
    filePath: path.resolve(
      process.cwd(),
      "..",
      "private-exports",
      "export-1.json",
    ),
    expiresAt: expired
      ? new Date(now.getTime() - 60_000)
      : new Date(now.getTime() + 60 * 60 * 1000),
    downloadedAt,
    store: {
      shopDomain: "shop.example",
      redactedAt: null,
    },
  };

  const matches = (record, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "store" && value) {
        return (
          record.store?.tenantId === value.tenantId ||
          value.tenantId === record.tenantId
        ) && record.store?.redactedAt === value.redactedAt;
      }

      if (value && typeof value === "object") {
        if ("gt" in value) return record[key] > value.gt;
      }

      return record[key] === value;
    });

  const prisma = {
    shopifyCustomerDataExport: {
      findFirst: async ({ where }) => {
        if (wrongTenant || where.tenantId !== exportRecord.tenantId) {
          return null;
        }

        return matches(exportRecord, {
          id: where.id,
          tenantId: where.tenantId,
        })
          ? exportRecord
          : null;
      },

      updateMany: async ({ where, data }) => {
        if (
          exportRecord.id !== where.id ||
          exportRecord.tenantId !== where.tenantId ||
          exportRecord.status !== where.status ||
          exportRecord.downloadedAt !== where.downloadedAt ||
          exportRecord.expiresAt <= where.expiresAt.gt ||
          exportRecord.store.redactedAt !== where.store.redactedAt
        ) {
          return { count: 0 };
        }

        exportRecord.downloadedAt = data.downloadedAt;
        return { count: 1 };
      },
    },

    shopifyCustomerRedaction: {
      findFirst: async () => (redacted ? { id: "redaction-1" } : null),
    },
  };

  prisma.$transaction = async (callback) => {
    state.transactionCalls += 1;
    return callback(prisma);
  };

  const fs = {
    constants: {
      R_OK: 4,
    },

    promises: {
      access: async (filePath) => {
        state.fileReads.push(filePath);

        if (!state.fileExists) {
          const error = new Error("File not found");
          error.code = "ENOENT";
          throw error;
        }
      },
    },

    createReadStream: (filePath) => {
      state.sentFile = filePath;

      return {
        on(event, callback) {
          if (event === "error" && state.streamError) {
            callback(state.streamError);
          }
          return this;
        },

        pipe(response) {
          response.streamPiped = true;
          return response;
        },
      };
    },
  };

  const createAuditLog = async (data) => {
    state.audits.push(data);
  };

  const executable = controllerSource
    .replace(/^import .*;\s*/gm, "")
    .replace(
      "export const downloadShopifyCustomerDataExport",
      "const downloadShopifyCustomerDataExport",
    );

  const downloadShopifyCustomerDataExport = new Function(
    "fs",
    "path",
    "prisma",
    "createAuditLog",
    `${executable}; return downloadShopifyCustomerDataExport;`,
  )(fs, path, prisma, createAuditLog);

  const req = {
    params: { exportId: "export-1" },
    tenantId: "tenant-1",
    userType: "TENANT",
    tenant: {
      id: "tenant-1",
      name: "Test Tenant",
      email: "tenant@example.com",
    },
  };

  const res = {
    headersSent: false,

    status(code) {
      state.responseStatus = code;
      return this;
    },

    json(body) {
      state.responseJson = body;
      return this;
    },

    setHeader(name, value) {
      state.responseHeaders[name] = value;
      return this;
    },

    destroy(error) {
      state.streamError = error;
      return this;
    },
  };

  return {
    downloadShopifyCustomerDataExport,
    exportRecord,
    state,
    req,
    res,
  };
}

test("downloads a completed export successfully", async () => {
  const harness = createHarness();

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, null);
  assert.ok(harness.exportRecord.downloadedAt instanceof Date);
  assert.equal(harness.state.transactionCalls, 1);
  assert.equal(harness.state.fileReads.length, 1);
  assert.equal(harness.state.audits.length, 1);
  assert.equal(harness.res.streamPiped, true);

  assert.equal(
    harness.state.audits[0].action,
    "SHOPIFY_CUSTOMER_DATA_EXPORT_DOWNLOADED",
  );

  assert.equal(
    harness.state.responseHeaders["Cache-Control"],
    "no-store, private",
  );
});

test("allows only one of two concurrent download attempts", async () => {
  const harness = createHarness();

  await Promise.all([
    harness.downloadShopifyCustomerDataExport(
      harness.req,
      harness.res,
    ),
    harness.downloadShopifyCustomerDataExport(
      harness.req,
      harness.res,
    ),
  ]);

  assert.ok(harness.exportRecord.downloadedAt instanceof Date);
  assert.equal(harness.state.transactionCalls, 2);
  assert.equal(harness.state.audits.length, 1);
  assert.equal(harness.res.streamPiped, true);
  assert.equal(harness.state.responseStatus, 410);
});

test("rejects an export belonging to another tenant", async () => {
  const harness = createHarness({ wrongTenant: true });

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 404);
  assert.equal(harness.state.fileReads.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test("rejects an export after customer redaction", async () => {
  const harness = createHarness({ redacted: true });

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 410);
  assert.equal(harness.state.fileReads.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test("rejects an expired export", async () => {
  const harness = createHarness({ expired: true });

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 410);
  assert.equal(harness.state.fileReads.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test("rejects an export that has already been downloaded", async () => {
  const harness = createHarness({
    downloadedAt: new Date(),
  });

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 410);
  assert.equal(harness.state.fileReads.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test("rejects an export that is not completed", async () => {
  const harness = createHarness({ status: "PROCESSING" });

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 410);
  assert.equal(harness.state.fileReads.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test("rejects an export when its private file is missing", async () => {
  const harness = createHarness({ missingFile: true });

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 410);
  assert.equal(harness.state.audits.length, 0);
  assert.equal(harness.exportRecord.downloadedAt, null);
});

test("keeps the export claimed when the download stream fails", async () => {
  const harness = createHarness();
  harness.state.streamError = new Error("Simulated stream failure");

  await harness.downloadShopifyCustomerDataExport(
    harness.req,
    harness.res,
  );

  assert.equal(harness.state.responseStatus, 500);
  assert.ok(harness.exportRecord.downloadedAt instanceof Date);
  assert.equal(harness.state.audits.length, 1);
});

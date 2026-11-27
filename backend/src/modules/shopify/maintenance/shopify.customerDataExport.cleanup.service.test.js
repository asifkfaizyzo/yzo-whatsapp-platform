
import assert from "node:assert/strict";
import path from "node:path";
import { after, beforeEach, mock, test } from "node:test";

const state = {
  records: [],
  unlinkedFiles: [],
  unlinkError: null,
  updateCount: 1,
  findManyArgs: null,
  updateManyArgs: [],
};

const fsMock = {
  unlink: async (filePath) => {
    if (state.unlinkError) {
      throw state.unlinkError;
    }

    state.unlinkedFiles.push(filePath);
  },
};

const prismaMock = {
  shopifyCustomerDataExport: {
    findMany: async (args) => {
      state.findManyArgs = args;
      return state.records.map((record) => ({ ...record }));
    },

    updateMany: async (args) => {
      state.updateManyArgs.push(args);

      if (state.updateCount === 0) {
        return { count: 0 };
      }

      const record = state.records.find(
        (item) =>
          item.id === args.where.id &&
          item.tenantId === args.where.tenantId &&
          item.storeId === args.where.storeId &&
          item.status === "COMPLETED" &&
          item.filePath === args.where.filePath,
      );

      if (!record) {
        return { count: 0 };
      }

      record.filePath = null;
      record.downloadTokenHash = null;

      return { count: 1 };
    },
  },
};

mock.module("fs/promises", {
  defaultExport: fsMock,
});

mock.module("../../../config/prisma.js", {
  defaultExport: prismaMock,
});

const {
  cleanupExpiredShopifyCustomerDataExports,
} = await import("./shopify.customerDataExport.cleanup.service.js");

const privateDirectory = path.join(
  process.cwd(),
  "test-private-exports",
);

const createExportRecord = (overrides = {}) => ({
  id: "export-123",
  tenantId: "tenant-123",
  storeId: "store-123",
  status: "COMPLETED",
  filePath: path.join(privateDirectory, "export-123.json"),
  expiresAt: new Date(Date.now() - 60 * 60 * 1000),
  downloadTokenHash: "test-token-hash",
  ...overrides,
});

beforeEach(() => {
  process.env.PRIVATE_EXPORTS_DIR = privateDirectory;

  state.records = [createExportRecord()];
  state.unlinkedFiles = [];
  state.unlinkError = null;
  state.updateCount = 1;
  state.findManyArgs = null;
  state.updateManyArgs = [];
});

after(() => {
  mock.restoreAll();
  delete process.env.PRIVATE_EXPORTS_DIR;
});

test("deletes expired export file and clears its database references", async () => {
  const result = await cleanupExpiredShopifyCustomerDataExports();

  assert.equal(result.found, 1);
  assert.equal(result.cleaned, 1);
  assert.equal(result.failed, 0);

  assert.equal(state.unlinkedFiles.length, 1);
  assert.equal(state.records[0].filePath, null);
  assert.equal(state.records[0].downloadTokenHash, null);
});

test("selects only completed exports with expired files", async () => {
  await cleanupExpiredShopifyCustomerDataExports();

  assert.deepEqual(state.findManyArgs.where.status, "COMPLETED");
  assert.ok(state.findManyArgs.where.expiresAt.lt instanceof Date);
  assert.deepEqual(state.findManyArgs.where.filePath, { not: null });
});

test("clears database references when the file is already missing", async () => {
  state.unlinkError = Object.assign(
    new Error("File not found"),
    { code: "ENOENT" },
  );

  const result = await cleanupExpiredShopifyCustomerDataExports();

  assert.equal(result.cleaned, 1);
  assert.equal(result.failed, 0);
  assert.equal(state.records[0].filePath, null);
});

test("does not clear database references when file deletion fails", async () => {
  state.unlinkError = Object.assign(
    new Error("Permission denied"),
    { code: "EACCES" },
  );

  const result = await cleanupExpiredShopifyCustomerDataExports();

  assert.equal(result.cleaned, 0);
  assert.equal(result.failed, 1);
  assert.notEqual(state.records[0].filePath, null);
  assert.equal(state.updateManyArgs.length, 0);
});

test("does not delete files outside the private export directory", async () => {
  state.records = [
    createExportRecord({
      filePath: path.join(process.cwd(), "uploads", "unexpected.json"),
    }),
  ];

  const result = await cleanupExpiredShopifyCustomerDataExports();

  assert.equal(result.failed, 1);
  assert.equal(state.unlinkedFiles.length, 0);
  assert.equal(state.updateManyArgs.length, 0);
});

test("does not clear database references if the record update matches nothing", async () => {
  state.updateCount = 0;

  const result = await cleanupExpiredShopifyCustomerDataExports();

  assert.equal(result.skipped, 1);
  assert.equal(result.cleaned, 0);
  assert.notEqual(state.records[0].filePath, null);
});

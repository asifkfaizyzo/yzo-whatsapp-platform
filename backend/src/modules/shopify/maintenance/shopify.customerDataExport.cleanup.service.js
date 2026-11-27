
import fs from "fs/promises";
import path from "path";
import prisma from "../../../config/prisma.js";

const getPrivateExportDirectory = () => {
  const configuredDirectory = process.env.PRIVATE_EXPORTS_DIR;

  const directory = path.resolve(
    configuredDirectory || path.join(process.cwd(), "..", "private-exports"),
  );

  const publicUploadsDirectory = path.resolve(
    process.cwd(),
    "uploads",
  );

  if (
    directory === publicUploadsDirectory ||
    directory.startsWith(`${publicUploadsDirectory}${path.sep}`)
  ) {
    throw new Error(
      "Private export directory cannot be inside public uploads",
    );
  }

  return directory;
};

export const cleanupExpiredShopifyCustomerDataExports = async () => {
  const now = new Date();
  const privateDirectory = getPrivateExportDirectory();

  const expiredExports = await prisma.shopifyCustomerDataExport.findMany({
    where: {
      status: "COMPLETED",
      expiresAt: {
        lt: now,
      },
      filePath: {
        not: null,
      },
    },
    select: {
      id: true,
      tenantId: true,
      storeId: true,
      filePath: true,
    },
  });

  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const exportRecord of expiredExports) {
    const expectedFilePath = path.join(
      privateDirectory,
      `${exportRecord.id}.json`,
    );

    const recordedFilePath = path.resolve(exportRecord.filePath);

    // Never delete a file outside the expected private export directory.
    if (recordedFilePath !== expectedFilePath) {
      failedCount += 1;

      console.error(
        `[ShopifyExportCleanup] Unexpected file path for export ${exportRecord.id}.`,
      );

      continue;
    }

    try {
      await fs.unlink(expectedFilePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        failedCount += 1;

        console.error(
          `[ShopifyExportCleanup] Could not delete export ${exportRecord.id}:`,
          error.message,
        );

        continue;
      }
    }

    try {
      const result = await prisma.shopifyCustomerDataExport.updateMany({
        where: {
          id: exportRecord.id,
          tenantId: exportRecord.tenantId,
          storeId: exportRecord.storeId,
          status: "COMPLETED",
          expiresAt: {
            lt: now,
          },
          filePath: exportRecord.filePath,
        },
        data: {
          filePath: null,
          downloadTokenHash: null,
        },
      });

      if (result.count === 1) {
        deletedCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      failedCount += 1;

      console.error(
        `[ShopifyExportCleanup] Could not update export ${exportRecord.id}:`,
        error.message,
      );
    }
  }

  const summary = {
    found: expiredExports.length,
    cleaned: deletedCount,
    skipped: skippedCount,
    failed: failedCount,
  };

  console.log("[ShopifyExportCleanup] Cleanup completed:", summary);

  return summary;
};

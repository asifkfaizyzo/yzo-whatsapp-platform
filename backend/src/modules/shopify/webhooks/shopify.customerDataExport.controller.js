
import fs from "fs";
import path from "path";

import prisma from "../../../config/prisma.js";
import { createAuditLog } from "../../audit/audit.service.js";

const getPrivateExportDirectory = () => {
  const configuredDirectory = process.env.PRIVATE_EXPORTS_DIR;

  const directory = path.resolve(
    configuredDirectory || path.join(process.cwd(), "..", "private-exports"),
  );

  const uploadsDirectory = path.resolve(process.cwd(), "uploads");

  if (
    directory === uploadsDirectory ||
    directory.startsWith(`${uploadsDirectory}${path.sep}`)
  ) {
    throw new Error("Private export directory cannot be inside public uploads");
  }

  return directory;
};


export const downloadShopifyCustomerDataExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    const tenantId = req.tenantId;

    if (!tenantId || !exportId) {
      return res.status(400).json({
        success: false,
        message: "Invalid export request",
      });
    }

    const exportRecord = await prisma.shopifyCustomerDataExport.findFirst({
      where: {
        id: exportId,
        tenantId,
        store: {
          tenantId,
          redactedAt: null,
        },
      },
      include: {
        store: {
          select: {
            shopDomain: true,
            redactedAt: true,
          },
        },
      },
    });

    if (!exportRecord) {
      return res.status(404).json({
        success: false,
        message: "Export not found",
      });
    }

    if (exportRecord.status === "REDACTED") {
      return res.status(410).json({
        success: false,
        message: "This customer export is no longer available",
      });
    }

    // Reject downloads when a customer-redaction request exists.
    const customerRedaction =
      await prisma.shopifyCustomerRedaction.findFirst({
        where: {
          tenantId,
          storeId: exportRecord.storeId,
          shopifyCustomerId: exportRecord.shopifyCustomerId,
        },
        select: { id: true },
      });

    if (customerRedaction) {
      return res.status(410).json({
        success: false,
        message: "This customer export is no longer available",
      });
    }

    if (
      exportRecord.status !== "COMPLETED" ||
      !exportRecord.filePath ||
      !exportRecord.expiresAt ||
      exportRecord.expiresAt <= new Date() ||
      exportRecord.downloadedAt
    ) {
      return res.status(410).json({
        success: false,
        message: "Export is expired, unavailable, or already downloaded",
      });
    }

    const privateDirectory = getPrivateExportDirectory();
    const filePath = path.resolve(exportRecord.filePath);

    if (
      path.dirname(filePath) !== privateDirectory ||
      path.basename(filePath) !== `${exportRecord.id}.json`
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid export file location",
      });
    }

    await fs.promises.access(filePath, fs.constants.R_OK);

    // Atomically claim the one-time download, provided no redaction exists.
    const claim = await prisma.$transaction(
      async (tx) => {
        const redaction = await tx.shopifyCustomerRedaction.findFirst({
          where: {
            tenantId,
            storeId: exportRecord.storeId,
            shopifyCustomerId: exportRecord.shopifyCustomerId,
          },
          select: { id: true },
        });

        if (redaction) {
          return 0;
        }

        const result = await tx.shopifyCustomerDataExport.updateMany({
          where: {
            id: exportRecord.id,
            tenantId,
            status: "COMPLETED",
            downloadedAt: null,
            expiresAt: { gt: new Date() },
            store: {
              tenantId,
              redactedAt: null,
            },
          },
          data: {
            downloadedAt: new Date(),
          },
        });

        return result.count;
      },
      { isolationLevel: "Serializable" }
    );

    if (claim !== 1) {
      return res.status(410).json({
        success: false,
        message: "Export has expired, been redacted, or has already been downloaded",
      });
    }

    await createAuditLog({
      actorId: req.userId || tenantId,
      actorType: req.userType === "USER" ? "USER" : "TENANT",
      actorName:
        req.user?.name ||
        req.tenant?.name ||
        "Authenticated SudoReply user",
      actorEmail:
        req.user?.email ||
        req.tenant?.email ||
        "unknown@sudoreply.internal",
      action: "SHOPIFY_CUSTOMER_DATA_EXPORT_DOWNLOADED",
      module: "INTEGRATIONS",
      description: "Shopify customer data export downloaded",
      targetId: exportRecord.id,
      targetType: "SHOPIFY_CUSTOMER_DATA_EXPORT",
      targetName: exportRecord.shopifyCustomerId,
      tenantId,
      metadata: {
        provider: "SHOPIFY",
        storeId: exportRecord.storeId,
        shopDomain: exportRecord.store.shopDomain,
        exportId: exportRecord.id,
      },
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="shopify-customer-export-${exportRecord.id}.json"`,
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => {
      console.error(
        "[Shopify Customer Export] Download stream failed:",
        error.message,
      );

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to download export",
        });
      } else {
        res.destroy(error);
      }
    });

    stream.pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(410).json({
        success: false,
        message: "Export file is no longer available",
      });
    }

    console.error(
      "[Shopify Customer Export] Download failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to download customer export",
    });
  }
};

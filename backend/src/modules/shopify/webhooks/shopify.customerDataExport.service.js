import axios from "axios";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import prisma from "../../../config/prisma.js";
import { getShopifyAccessToken } from "../shopify.service.js";
import { createAuditLog } from "../../audit/audit.service.js";

const EXPORT_EXPIRY_HOURS = 24;
const SHOPIFY_API_TIMEOUT = 15000;

const getPrivateExportDirectory = () => {
  const configuredDirectory = process.env.PRIVATE_EXPORTS_DIR;

  // Default is outside backend/uploads.
  const directory = path.resolve(
    configuredDirectory || path.join(process.cwd(), "..", "private-exports"),
  );

  const publicUploadsDirectory = path.resolve(process.cwd(), "uploads");

  if (
    directory === publicUploadsDirectory ||
    directory.startsWith(`${publicUploadsDirectory}${path.sep}`)
  ) {
    throw new Error("Private export directory cannot be inside public uploads");
  }

  return directory;
};

const writePrivateExport = async (exportId, data) => {
  const directory = getPrivateExportDirectory();

  await fs.mkdir(directory, {
    recursive: true,
    mode: 0o700,
  });

  const fileName = `${exportId}.json`;
  const filePath = path.join(directory, fileName);
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;

  try {
    await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });

    await fs.rename(temporaryPath, filePath);

    return filePath;
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
};

const fetchShopifyCustomer = async ({
  shopDomain,
  accessToken,
  customerId,
}) => {
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";

  const response = await axios.get(
    `https://${shopDomain}/admin/api/${apiVersion}/customers/${encodeURIComponent(customerId)}.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
      timeout: SHOPIFY_API_TIMEOUT,
    },
  );

  return response.data?.customer || null;
};

const fetchShopifyCustomerOrders = async ({
  shopDomain,
  accessToken,
  customerId,
}) => {
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";
  const orders = [];

  let nextUrl =
    `https://${shopDomain}/admin/api/${apiVersion}/orders.json` +
    `?status=any&customer_id=${encodeURIComponent(customerId)}&limit=250`;

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
      timeout: SHOPIFY_API_TIMEOUT,
    });

    orders.push(...(response.data?.orders || []));

    const linkHeader = response.headers?.link || "";
    const nextLink = linkHeader
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.includes('rel="next"'));

    if (!nextLink) {
      nextUrl = null;
      continue;
    }

    const match = nextLink.match(/<([^>]+)>/);
    nextUrl = match?.[1] || null;
  }

  return orders;
};

const createSystemAuditLog = async ({
  tenantId,
  action,
  description,
  exportId,
  storeId,
  customerId,
}) => {
  await createAuditLog({
    actorId: null,
    actorType: "SYSTEM",
    actorName: "Shopify Privacy Webhook",
    actorEmail: "system@sudoreply.internal",
    action,
    module: "INTEGRATIONS",
    description,
    targetId: exportId,
    targetType: "SHOPIFY_CUSTOMER_DATA_EXPORT",
    targetName: customerId,
    tenantId,
    metadata: {
      provider: "SHOPIFY",
      storeId,
      shopifyCustomerId: customerId,
      exportId,
    },
  });
};

export const processShopifyCustomerDataExport = async (jobData) => {
  const { exportId, tenantId, storeId, shopifyCustomerId, shopDomain } =
    jobData || {};

  if (!exportId || !tenantId || !storeId || !shopifyCustomerId || !shopDomain) {
    throw new Error("Missing required Shopify customer export job data");
  }

  const customerId = String(shopifyCustomerId);

  const exportRecord = await prisma.shopifyCustomerDataExport.findFirst({
    where: {
      id: exportId,
      tenantId,
      storeId,
      shopifyCustomerId: customerId,
    },
  });

  if (!exportRecord) {
    throw new Error(
      "Shopify customer data export record not found or ownership validation failed",
    );
  }

  if (exportRecord.status === "REDACTED") {
    return { success: true, skipped: true, reason: "customer_redacted" };
  }

  if (exportRecord.status === "COMPLETED") {
    return {
      success: true,
      alreadyCompleted: true,
      exportId: exportRecord.id,
    };
  }

  const isCustomerRedacted = async () => {
    const redaction = await prisma.shopifyCustomerRedaction.findFirst({
      where: {
        tenantId,
        storeId,
        shopifyCustomerId: customerId,
      },
      select: { id: true },
    });

    return Boolean(redaction);
  };

  let generatedFilePath = null;
  let processingStartedAt = null;

  try {
    if (await isCustomerRedacted()) {
      await prisma.shopifyCustomerDataExport.updateMany({
        where: {
          id: exportRecord.id,
          tenantId,
          storeId,
          status: { not: "REDACTED" },
        },
        data: {
          status: "REDACTED",
          processingStartedAt: null,
          filePath: null,
        },
      });

      return { success: true, skipped: true, reason: "customer_redacted" };
    }

    // A PROCESSING export can only be reclaimed after its previous
    // processing claim has become stale.
    const staleBefore = new Date(Date.now() - 30 * 1000);
    processingStartedAt = new Date();

    const processingUpdate = await prisma.shopifyCustomerDataExport.updateMany({
      where: {
        id: exportRecord.id,
        tenantId,
        storeId,
        shopifyCustomerId: customerId,
        OR: [
          { status: { in: ["PENDING", "FAILED"] } },
          {
            status: "PROCESSING",
            processingStartedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        processingStartedAt,
        failureReason: null,
      },
    });

    if (processingUpdate.count !== 1) {
      return {
        success: true,
        skipped: true,
        reason: "export_already_processing_or_no_longer_active",
      };
    }

    const store = await prisma.shopifyStore.findFirst({
      where: {
        id: storeId,
        tenantId,
        shopDomain,
        redactedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        shopDomain: true,
      },
    });

    if (!store) {
      throw new Error("Shopify store not found, inactive, or already redacted");
    }

    const accessToken = await getShopifyAccessToken(tenantId);

    const customer = await fetchShopifyCustomer({
      shopDomain: store.shopDomain,
      accessToken,
      customerId,
    });

    if (!customer) {
      throw new Error("Shopify customer record was not returned");
    }

    const shopifyOrders = await fetchShopifyCustomerOrders({
      shopDomain: store.shopDomain,
      accessToken,
      customerId,
    });

    const [localOrders, messages] = await Promise.all([
      prisma.ecommerceOrder.findMany({
        where: {
          tenantId,
          source: "SHOPIFY",
          shopifyStoreId: storeId,
          shopifyCustomerId: customerId,
        },
      }),

      prisma.message.findMany({
        where: {
          tenantId,
          source: "SHOPIFY",
          shopifyStoreId: storeId,
          shopifyCustomerId: customerId,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (await isCustomerRedacted()) {
      await prisma.shopifyCustomerDataExport.updateMany({
        where: {
          id: exportRecord.id,
          status: "PROCESSING",
          processingStartedAt,
        },
        data: {
          status: "REDACTED",
          processingStartedAt: null,
          filePath: null,
        },
      });

      return { success: true, skipped: true, reason: "customer_redacted" };
    }

    const storeStillActive = await prisma.shopifyStore.findFirst({
      where: {
        id: storeId,
        tenantId,
        shopDomain,
        redactedAt: null,
      },
      select: { id: true },
    });

    if (!storeStillActive) {
      throw new Error("Shopify store was redacted during export generation");
    }

    const exportData = {
      exportInformation: {
        provider: "SHOPIFY",
        shopDomain: store.shopDomain,
        shopifyCustomerId: customerId,
        requestedAt: exportRecord.createdAt,
        generatedAt: new Date().toISOString(),
      },
      customer,
      shopifyOrders,
      sudoreplyOrders: localOrders,
      shopifyMessages: messages,
    };

    generatedFilePath = await writePrivateExport(exportRecord.id, exportData);

    const expiresAt = new Date(
      Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const finalized = await prisma.$transaction(
      async (tx) => {
        const redaction = await tx.shopifyCustomerRedaction.findFirst({
          where: {
            tenantId,
            storeId,
            shopifyCustomerId: customerId,
          },
          select: { id: true },
        });

        const activeStore = await tx.shopifyStore.findFirst({
          where: {
            id: storeId,
            tenantId,
            shopDomain,
            redactedAt: null,
          },
          select: { id: true },
        });

        const activeExport = await tx.shopifyCustomerDataExport.findFirst({
          where: {
            id: exportRecord.id,
            tenantId,
            storeId,
            shopifyCustomerId: customerId,
            status: "PROCESSING",
            processingStartedAt,
          },
          select: { id: true },
        });

        if (redaction || !activeStore || !activeExport) {
          return false;
        }

        const result = await tx.shopifyCustomerDataExport.updateMany({
          where: {
            id: exportRecord.id,
            tenantId,
            storeId,
            status: "PROCESSING",
            processingStartedAt,
          },
          data: {
            status: "COMPLETED",
            processingStartedAt: null,
            filePath: generatedFilePath,
            generatedAt: new Date(),
            expiresAt,
            failureReason: null,
          },
        });

        return result.count === 1;
      },
      { isolationLevel: "Serializable" },
    );

    if (!finalized) {
      await fs.unlink(generatedFilePath).catch(() => {});
      generatedFilePath = null;

      if (await isCustomerRedacted()) {
        await prisma.shopifyCustomerDataExport.updateMany({
          where: {
            id: exportRecord.id,
            status: "PROCESSING",
            processingStartedAt,
          },
          data: {
            status: "REDACTED",
            processingStartedAt: null,
            filePath: null,
          },
        });

        return { success: true, skipped: true, reason: "customer_redacted" };
      }

      return {
        success: true,
        skipped: true,
        reason: "export_claim_lost_or_store_inactive",
      };
    }

    await createSystemAuditLog({
      tenantId,
      action: "SHOPIFY_CUSTOMER_DATA_EXPORT_GENERATED",
      description: "Shopify customer data export generated successfully",
      exportId: exportRecord.id,
      storeId,
      customerId,
    });

    return {
      success: true,
      exportId: exportRecord.id,
      expiresAt,
    };
  } catch (error) {
    const redacted = await isCustomerRedacted().catch(() => false);

    if (redacted) {
      await prisma.shopifyCustomerDataExport.updateMany({
        where: {
          id: exportRecord.id,
          status: "PROCESSING",
          processingStartedAt,
        },
        data: {
          status: "REDACTED",
          processingStartedAt: null,
          filePath: null,
        },
      });

      return { success: true, skipped: true, reason: "customer_redacted" };
    }

    await prisma.shopifyCustomerDataExport
      .updateMany({
        where: {
          id: exportRecord.id,
          tenantId,
          storeId,
          status: "PROCESSING",
          processingStartedAt,
        },
        data: {
          status: "FAILED",
          processingStartedAt: null,
          filePath: null,
          failureReason: String(
            error.message || "Export generation failed",
          ).slice(0, 2000),
        },
      })
      .catch((updateError) => {
        console.error(
          "[Shopify Customer Export] Failed to update export status:",
          updateError.message,
        );
      });

    console.error(
      "[Shopify Customer Export] Generation failed:",
      error.message,
    );

    throw error;
  }
};

// backend/src/modules/shopify/customers/shopify.customerSync.service.js (do not remove this comment)
import axios from "axios";
import prisma from "../../../config/prisma.js";
import { getShopifyAccessToken } from "../shopify.service.js";

/**
 * Helper to format Shopify address into a single readable location string
 */
const formatShopifyAddress = (addr) => {
  if (!addr || typeof addr !== "object") return null;
  const parts = [
    addr.address1,
    addr.city,
    addr.province || addr.state,
    addr.country,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
};

/**
 * Sync a single Shopify customer record into SudoReply Contact system.
 */
 export const syncShopifyCustomer = async (tenantId, storeId, customerPayload) => {
  if (!tenantId || !storeId || !customerPayload?.id) return null;

  const shopifyId = String(customerPayload.id);

  return await prisma.$transaction(async (tx) => {
    // Serialize syncs for this specific Shopify store/customer.
    await tx.$queryRaw`
  SELECT 1
  FROM (
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${storeId}:${shopifyId}`}, 0)
    )
  ) AS lock_result
`;

    // Confirm this Shopify store belongs to the tenant and is active.
    const shopifyStore = await tx.shopifyStore.findFirst({
      where: {
        id: storeId,
        tenantId,
        status: "active",
        redactedAt: null,
      },
      select: { id: true },
    });

    if (!shopifyStore) {
      throw new Error("Active Shopify store not found for this tenant");
    }

    const redaction = await tx.shopifyCustomerRedaction.findUnique({
      where: {
        storeId_shopifyCustomerId: {
          storeId,
          shopifyCustomerId: shopifyId,
        },
      },
      select: { id: true },
    });

    if (redaction) return null;

    const firstName = customerPayload.first_name || "";
    const lastName = customerPayload.last_name || "";
    const fullName =
      `${firstName} ${lastName}`.trim() ||
      customerPayload.email ||
      `Customer ${shopifyId}`;

    // Extract and format phone to E.164
    let rawPhone =
      customerPayload.phone ||
      customerPayload.default_address?.phone ||
      customerPayload.addresses?.[0]?.phone ||
      "";
    let formattedPhone = null;
    let cleanDigits = null;

    if (rawPhone) {
      cleanDigits = String(rawPhone).replace(/\D/g, "");
      if (cleanDigits.length >= 8) {
        formattedPhone = `+${cleanDigits}`;
      }
    }

    // Email
    const email = customerPayload.email || null;

    if (!formattedPhone && !email) {
      console.log(
        `⚠️ [Shopify Sync] Customer ${shopifyId} (${fullName}) has no phone or email. Skipping.`,
      );
      return null;
    }

    // Extract formatted customer address
    const rawAddressObj =
      customerPayload.default_address || customerPayload.addresses?.[0] || null;
    const formattedAddress = formatShopifyAddress(rawAddressObj);

    // 1. Find the store-specific Shopify customer mapping.
    const shopifyMapping = await tx.shopifyCustomerMapping.findUnique({
      where: {
        storeId_shopifyCustomerId: {
          storeId,
          shopifyCustomerId: shopifyId,
        },
      },
      include: { contact: true },
    });

    if (shopifyMapping && shopifyMapping.tenantId !== tenantId) {
      throw new Error("Shopify customer mapping tenant mismatch");
    }

    // A mapping must never point to another tenant's contact.
    if (shopifyMapping && shopifyMapping.contact.tenantId !== tenantId) {
      throw new Error("Shopify customer mapping tenant mismatch");
    }

    // Legacy fallback: preserve existing Shopify customer-to-contact links.
    let legacyContact = null;

    if (!shopifyMapping) {
      const legacyMapping = await tx.contactProviderMapping.findFirst({
        where: {
          tenantId,
          provider: "SHOPIFY",
          providerContactId: shopifyId,
        },
        include: { contact: true },
      });

      legacyContact = legacyMapping?.contact || null;

      if (legacyContact && legacyContact.tenantId !== tenantId) {
        throw new Error("Legacy Shopify contact mapping tenant mismatch");
      }
    }

    let contact = shopifyMapping?.contact || legacyContact;

    // 2. If no provider mapping exists, check existing Contact by phone or email
    if (!contact) {
      if (formattedPhone) {
        contact = await tx.contact.findUnique({
          where: { phone_tenantId: { phone: formattedPhone, tenantId } },
        });
      }

      if (!contact && email) {
        contact = await tx.contact.findFirst({
          where: { email: { equals: email, mode: "insensitive" }, tenantId },
        });
      }
    }

    // 3. Create Contact only if none exists.
    if (!contact) {
      contact = await tx.contact.create({
        data: {
          tenantId,
          name: fullName,
          phone: formattedPhone || `+000${shopifyId}`,
          email: email,
          whatsappId: cleanDigits ? cleanDigits.slice(-10) : null,
          company: formattedAddress,
          createdAt: customerPayload.created_at
            ? new Date(customerPayload.created_at)
            : new Date(),
        },
      });
      console.log(
        `✅ [Shopify Sync] Created new SudoReply Contact: ${contact.name} (${contact.id})`,
      );
    }

    // 4. Validate contact ownership before recording the mapping.
    if (!contact || !contact.id || contact.tenantId !== tenantId) {
      throw new Error("Cannot map Shopify customer to an invalid or foreign contact");
    }

    // Record store-specific Shopify Customer Mapping safely.
    const savedMapping = await tx.shopifyCustomerMapping.upsert({
      where: {
        storeId_shopifyCustomerId: {
          storeId,
          shopifyCustomerId: shopifyId,
        },
      },
      create: {
        storeId,
        tenantId,
        contactId: contact.id,
        shopifyCustomerId: shopifyId,
        lastSyncedAt: new Date(),
      },
      update: {
        lastSyncedAt: new Date(),
      },
      include: { contact: true },
    });

    if (
      savedMapping.tenantId !== tenantId ||
      savedMapping.contact.tenantId !== tenantId
    ) {
      throw new Error("Saved Shopify customer mapping tenant mismatch");
    }

    // Always update the contact actually assigned to this Shopify customer.
    contact = savedMapping.contact;

    const updateData = {};
    if (fullName && contact.name !== fullName) updateData.name = fullName;
    if (email && !contact.email) updateData.email = email;
    if (formattedPhone && (!contact.phone || contact.phone.startsWith("+000")))
      updateData.phone = formattedPhone;
    if (formattedAddress && contact.company !== formattedAddress)
      updateData.company = formattedAddress;

    if (Object.keys(updateData).length > 0) {
      contact = await tx.contact.update({
        where: { id: contact.id, tenantId },
        data: updateData,
      });
    }

    return contact;
  });
};



/**
 * Fetch and sync all store customers using REST Admin API cursor pagination
 */
export const syncAllShopifyCustomers = async (tenantId) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId },
  });

  if (!connection || connection.status !== "active") {
    throw new Error("No active Shopify connection found for this tenant");
  }

  if (!connection.storeId) {
  throw new Error("Shopify connection is missing its store identity");
}

  const shopName = connection.shopName;
  const accessToken = await getShopifyAccessToken(tenantId);
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";

  let pageInfo = null;
  let totalSynced = 0;
  let hasNextPage = true;

  console.log(
    `🚀 [Shopify Sync] Starting full customer sync for ${shopName}...`,
  );

  while (hasNextPage) {
    let url = `https://${shopName}/admin/api/${apiVersion}/customers.json?limit=250`;
    if (pageInfo) {
      url += `&page_info=${pageInfo}`;
    }

    const response = await axios.get(url, {
      headers: { "X-Shopify-Access-Token": accessToken },
      timeout: 15000,
    });

    const customers = response.data?.customers || [];

    for (const customer of customers) {
      try {
        await syncShopifyCustomer(tenantId, connection.storeId, customer);
        totalSynced++;
      } catch (err) {
        console.error(
          `❌ [Shopify Sync] Error syncing customer ${customer.id}:`,
          err.message,
        );
      }
    }

    // Parse Link header for cursor pagination
    const linkHeader = response.headers["link"] || response.headers["Link"];
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/page_info=([^>&]+)>;\s*rel="next"/);
      pageInfo = match ? match[1] : null;
      hasNextPage = Boolean(pageInfo);
    } else {
      hasNextPage = false;
    }
  }

  console.log(
    `🎉 [Shopify Sync] Completed customer sync. Total processed: ${totalSynced}`,
  );
  return { totalSynced };
};

import axios from 'axios';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';


/**
 * Helper to format Shopify address into a single readable location string
 */
const formatShopifyAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return null;
  const parts = [
    addr.address1,
    addr.city,
    addr.province || addr.state,
    addr.country
  ].map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
};

/**
 * Sync a single Shopify customer record into SudoReply Contact system.
 */
export const syncShopifyCustomer = async (tenantId, customerPayload) => {
  if (!tenantId || !customerPayload) return null;

  const shopifyId = String(customerPayload.id);
  const firstName = customerPayload.first_name || '';
  const lastName = customerPayload.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || customerPayload.email || `Customer ${shopifyId}`;

  // Extract and format phone to E.164
  let rawPhone = customerPayload.phone || customerPayload.default_address?.phone || customerPayload.addresses?.[0]?.phone || '';
  let formattedPhone = null;
  let cleanDigits = null;

  if (rawPhone) {
    cleanDigits = String(rawPhone).replace(/\D/g, '');
    if (cleanDigits.length >= 8) {
      formattedPhone = `+${cleanDigits}`;
    }
  }

  // Email
  const email = customerPayload.email || null;

  if (!formattedPhone && !email) {
    console.log(`⚠️ [Shopify Sync] Customer ${shopifyId} (${fullName}) has no phone or email. Skipping.`);
    return null;
  }

  // Extract formatted customer address
  const rawAddressObj = customerPayload.default_address || customerPayload.addresses?.[0] || null;
  const formattedAddress = formatShopifyAddress(rawAddressObj);

  // 1. Check if Provider Mapping exists
  let providerMapping = await prisma.contactProviderMapping.findFirst({
    where: {
      tenantId,
      provider: 'SHOPIFY',
      providerContactId: shopifyId
    },
    include: { contact: true }
  });

  let contact = providerMapping?.contact;

  // 2. If no provider mapping exists, check existing Contact by phone or email
  if (!contact) {
    if (formattedPhone) {
      contact = await prisma.contact.findUnique({
        where: { phone_tenantId: { phone: formattedPhone, tenantId } }
      });
    }

    if (!contact && email) {
      contact = await prisma.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, tenantId }
      });
    }
  }

  // 3. Create or Update Contact
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        name: fullName,
        phone: formattedPhone || `+000${shopifyId}`,
        email: email,
        whatsappId: cleanDigits ? cleanDigits.slice(-10) : null,
        company: formattedAddress,
        createdAt: customerPayload.created_at ? new Date(customerPayload.created_at) : new Date()
      }
    });
    console.log(`✅ [Shopify Sync] Created new SudoReply Contact: ${contact.name} (${contact.id})`);
  } else {
    const updateData = {};
    if (fullName && contact.name !== fullName) updateData.name = fullName;
    if (email && !contact.email) updateData.email = email;
    if (formattedPhone && (!contact.phone || contact.phone.startsWith('+000'))) updateData.phone = formattedPhone;
    if (formattedAddress && contact.company !== formattedAddress) updateData.company = formattedAddress;

    if (Object.keys(updateData).length > 0) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: updateData
      });
    }
  }

  // 4. Record Provider Mapping
  if (!providerMapping) {
    await prisma.contactProviderMapping.create({
      data: {
        tenantId,
        contactId: contact.id,
        provider: 'SHOPIFY',
        providerContactId: shopifyId,
        lastSyncedAt: new Date()
      }
    });
  } else {
    await prisma.contactProviderMapping.update({
      where: { id: providerMapping.id },
      data: { lastSyncedAt: new Date() }
    });
  }

  return contact;
};

/**
 * Fetch and sync all store customers using REST Admin API cursor pagination
 */
export const syncAllShopifyCustomers = async (tenantId) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { tenantId }
  });

  if (!connection || connection.status !== 'active') {
    throw new Error('No active Shopify connection found for this tenant');
  }

  const shopName = connection.shopName;
  const accessToken = decrypt(connection.accessToken);
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';

  let pageInfo = null;
  let totalSynced = 0;
  let hasNextPage = true;

  console.log(`🚀 [Shopify Sync] Starting full customer sync for ${shopName}...`);

  while (hasNextPage) {
    let url = `https://${shopName}/admin/api/${apiVersion}/customers.json?limit=250`;
    if (pageInfo) {
      url += `&page_info=${pageInfo}`;
    }

    const response = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      timeout: 15000
    });

    const customers = response.data?.customers || [];

    for (const customer of customers) {
      try {
        await syncShopifyCustomer(tenantId, customer);
        totalSynced++;
      } catch (err) {
        console.error(`❌ [Shopify Sync] Error syncing customer ${customer.id}:`, err.message);
      }
    }

    // Parse Link header for cursor pagination
    const linkHeader = response.headers['link'] || response.headers['Link'];
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/page_info=([^>&]+)>;\s*rel="next"/);
      pageInfo = match ? match[1] : null;
      hasNextPage = Boolean(pageInfo);
    } else {
      hasNextPage = false;
    }
  }

  console.log(`🎉 [Shopify Sync] Completed customer sync. Total processed: ${totalSynced}`);
  return { totalSynced };
};
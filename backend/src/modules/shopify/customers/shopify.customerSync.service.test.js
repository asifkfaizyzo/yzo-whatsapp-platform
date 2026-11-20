
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const state = {
  store: {
    id: "test-store-1",
    tenantId: "test-tenant-1",
    status: "active",
    redactedAt: null,
  },
  contacts: [],
  mappings: [],
  contactCreateCalls: 0,
  mappingUpsertCalls: 0,
  lockCalls: 0,
  nextContactId: 1,
};

const locks = new Map();

function resetState() {
  state.contacts = [];
  state.mappings = [];
  state.contactCreateCalls = 0;
  state.mappingUpsertCalls = 0;
  state.lockCalls = 0;
  state.nextContactId = 1;
}

async function acquireLock(key) {
  const previous = locks.get(key) || Promise.resolve();

  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });

  locks.set(key, current);
  await previous;

  return () => {
    release();
    if (locks.get(key) === current) {
      locks.delete(key);
    }
  };
}

const prismaMock = {
  async $transaction(callback) {
    const releases = [];

    const tx = {
      $queryRaw: async (strings, ...values) => {
        state.lockCalls++;
        const release = await acquireLock(values[0]);
        releases.push(release);
        return [];
      },

      shopifyStore: {
        findFirst: async ({ where }) => {
          if (
            state.store.id === where.id &&
            state.store.tenantId === where.tenantId &&
            state.store.status === where.status &&
            state.store.redactedAt === where.redactedAt
          ) {
            return { id: state.store.id };
          }

          return null;
        },
      },

      shopifyCustomerMapping: {
        findUnique: async ({ where }) => {
          return (
            state.mappings.find(
              (mapping) =>
                mapping.storeId ===
                  where.storeId_shopifyCustomerId.storeId &&
                mapping.shopifyCustomerId ===
                  where.storeId_shopifyCustomerId.shopifyCustomerId,
            ) || null
          );
        },

        upsert: async ({ where, create, include }) => {
          state.mappingUpsertCalls++;

          let mapping = state.mappings.find(
            (item) =>
              item.storeId ===
                where.storeId_shopifyCustomerId.storeId &&
              item.shopifyCustomerId ===
                where.storeId_shopifyCustomerId.shopifyCustomerId,
          );

          if (!mapping) {
            const contact = state.contacts.find(
              (item) => item.id === create.contactId,
            );

            mapping = {
              ...create,
              contact,
            };

            state.mappings.push(mapping);
          }

          const contact = state.contacts.find(
            (item) => item.id === mapping.contactId,
          );

          return {
            ...mapping,
            contact,
          };
        },
      },

      contactProviderMapping: {
        findFirst: async () => null,
      },

      contact: {
        findUnique: async ({ where }) => {
          return (
            state.contacts.find(
              (contact) =>
                contact.phone === where.phone_tenantId.phone &&
                contact.tenantId === where.phone_tenantId.tenantId,
            ) || null
          );
        },

        findFirst: async ({ where }) => {
          return (
            state.contacts.find(
              (contact) =>
                contact.tenantId === where.tenantId &&
                contact.email?.toLowerCase() ===
                  where.email.equals.toLowerCase(),
            ) || null
          );
        },

        create: async ({ data }) => {
          state.contactCreateCalls++;

          const contact = {
            id: `test-contact-${state.nextContactId++}`,
            ...data,
          };

          state.contacts.push(contact);
          return contact;
        },

        update: async ({ where, data }) => {
          const contact = state.contacts.find(
            (item) =>
              item.id === where.id &&
              item.tenantId === where.tenantId,
          );

          if (!contact) {
            throw new Error("Contact not found for tenant");
          }

          Object.assign(contact, data);
          return contact;
        },
      },
    };

    try {
      return await callback(tx);
    } finally {
      releases.reverse().forEach((release) => release());
    }
  },
};

mock.module("../../../config/prisma.js", {
  defaultExport: prismaMock,
});

mock.module("../shopify.service.js", {
  namedExports: {
    getShopifyAccessToken: async () => null,
  },
});

const { syncShopifyCustomer } = await import(
  "./shopify.customerSync.service.js"
);

const customerPayload = {
  id: 12345,
  first_name: "Test",
  last_name: "Customer",
  email: "synthetic@example.invalid",
  phone: "+15551234567",
};

test("creates a contact and store-specific customer mapping", async () => {
  resetState();

  const contact = await syncShopifyCustomer(
    "test-tenant-1",
    "test-store-1",
    customerPayload,
  );

  assert.ok(contact);
  assert.equal(contact.tenantId, "test-tenant-1");
  assert.equal(state.contacts.length, 1);
  assert.equal(state.mappings.length, 1);
  assert.equal(state.mappings[0].storeId, "test-store-1");
  assert.equal(state.mappings[0].shopifyCustomerId, "12345");
  assert.equal(state.mappings[0].contactId, contact.id);
  assert.equal(state.lockCalls, 1);
});

test("rejects a store belonging to another tenant without writes", async () => {
  resetState();

  await assert.rejects(
    syncShopifyCustomer(
      "wrong-tenant",
      "test-store-1",
      customerPayload,
    ),
    /Active Shopify store not found/,
  );

  assert.equal(state.contactCreateCalls, 0);
  assert.equal(state.mappingUpsertCalls, 0);
  assert.equal(state.mappings.length, 0);
});

test("reuses an existing store-specific customer mapping", async () => {
  resetState();

  const existingContact = {
    id: "existing-contact-1",
    tenantId: "test-tenant-1",
    name: "Test Customer",
    email: "synthetic@example.invalid",
    phone: "+15551234567",
    company: null,
  };

  state.contacts.push(existingContact);

  state.mappings.push({
    id: "existing-mapping-1",
    storeId: "test-store-1",
    tenantId: "test-tenant-1",
    shopifyCustomerId: "12345",
    contactId: existingContact.id,
    contact: existingContact,
  });

  const contact = await syncShopifyCustomer(
    "test-tenant-1",
    "test-store-1",
    customerPayload,
  );

  assert.equal(contact.id, existingContact.id);
  assert.equal(state.contacts.length, 1);
  assert.equal(state.contactCreateCalls, 0);
  assert.equal(state.mappings.length, 1);
});

test("rejects an existing mapping with the wrong tenant", async () => {
  resetState();

  const existingContact = {
    id: "existing-contact-2",
    tenantId: "test-tenant-1",
    name: "Test Customer",
  };

  state.contacts.push(existingContact);

  state.mappings.push({
    id: "wrong-tenant-mapping",
    storeId: "test-store-1",
    tenantId: "another-tenant",
    shopifyCustomerId: "12345",
    contactId: existingContact.id,
    contact: existingContact,
  });

  await assert.rejects(
    syncShopifyCustomer(
      "test-tenant-1",
      "test-store-1",
      customerPayload,
    ),
    /Shopify customer mapping tenant mismatch/,
  );

  assert.equal(state.contactCreateCalls, 0);
  assert.equal(state.mappingUpsertCalls, 0);
});

test("serializes concurrent first-time syncs for the same customer", async () => {
  resetState();

  const firstPayload = {
    ...customerPayload,
    phone: "+15551234567",
  };

  const secondPayload = {
    ...customerPayload,
    phone: "+15557654321",
  };

  const [firstContact, secondContact] = await Promise.all([
    syncShopifyCustomer(
      "test-tenant-1",
      "test-store-1",
      firstPayload,
    ),
    syncShopifyCustomer(
      "test-tenant-1",
      "test-store-1",
      secondPayload,
    ),
  ]);

  assert.equal(state.contacts.length, 1);
  assert.equal(state.contactCreateCalls, 1);
  assert.equal(state.mappings.length, 1);
  assert.equal(firstContact.id, secondContact.id);
  assert.equal(state.lockCalls, 2);
});

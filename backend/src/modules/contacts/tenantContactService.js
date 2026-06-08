import {
  createContact, getAllContacts, getContactById,
  updateContact, deleteContact, blockContact,
  unblockContact,
} from './contactCrudService.js';



export const tenantCreateContact = async (data, tenantId) => {
  return await createContact(data, tenantId);
};

export const tenantGetAllContacts = async (tenantId, page, limit, search) => {
  return await getAllContacts(tenantId);
};

export const tenantGetContactById = async (contactId, tenantId) => {
  return await getContactById(contactId, tenantId);
};

export const tenantUpdateContact = async (contactId, tenantId, data) => {
  return await updateContact(contactId, tenantId, data);
};

export const tenantDeleteContact = async (contactId, tenantId) => {
  return await deleteContact(contactId, tenantId);
};

export const tenantBlockContact = async (contactId, tenantId) => {
  return await blockContact(contactId, tenantId);
};

export const tenantUnblockContact = async (contactId, tenantId) => {
  return await unblockContact(contactId, tenantId);
};
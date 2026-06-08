import {
    createContact, getAllContacts, getContactById,
    updateContact, deleteContact, blockContact,
    unblockContact,
} from './contactCrudService.js';




export const userCreateContact = async (data, tenantId) => {
    return await createContact(data, tenantId);
};

export const userGetAllContacts = async (tenantId, page, limit, search) => {
    return await getAllContacts(tenantId);
};

export const userGetContactById = async (contactId, tenantId) => {
    return await getContactById(contactId, tenantId);
};

export const userUpdateContact = async (contactId, tenantId, data) => {
    return await updateContact(contactId, tenantId, data);
};

export const userDeleteContact = async (contactId, tenantId) => {
    return await deleteContact(contactId, tenantId);
};

export const userBlockContact = async (contactId, tenantId) => {
    return await blockContact(contactId, tenantId);
};

export const userUnblockContact = async (contactId, tenantId) => {
    return await unblockContact(contactId, tenantId);
};
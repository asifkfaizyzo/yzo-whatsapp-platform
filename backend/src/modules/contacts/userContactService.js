import {
    createContact, getAllContacts, getContactById,
    updateContact, deleteContact, blockContact,
    unblockContact, getUnassignedContacts ,
    findContactsByIds,assignMultipleContacts ,findTenantUser ,
    getContactsByIds,  updateContactsBatch 
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

export const userGetUnassignedContacts = async (tenantId) => {
    return await getUnassignedContacts(tenantId);
};



//Assign multiple contacts
export const userAssignMultipleContacts = async (contactIds, userId, tenantId) => {
    // 1. Validation
    const user = await findTenantUser(userId, tenantId);
    if (!user) throw new Error("User not found");

    // 2. Fetch contacts
    const contacts = await getContactsByIds(contactIds, tenantId);

    // 3. Logic: Check for Scenario 3 (Assigned to another user)
    const conflict = contacts.find(c => c.assignedTo !== null && c.assignedTo !== userId);
    if (conflict) {
        return { message: `Contacts are assigned to another user (${conflict.assignedTo})` };
    }

    // 4. Logic: Check for Scenario 2 (Already assigned to same user)
    const alreadyAssigned = contacts.every(c => c.assignedTo === userId);
    if (alreadyAssigned) {
        return { message: "Contacts are already assigned to the same user" };
    }

    // 5. Scenario 1: Assign them (Success)
    await updateContactsBatch(contactIds, userId);
    return { message: `Successfully assigned ${contactIds.length} contact(s) to user ${userId}` };
};




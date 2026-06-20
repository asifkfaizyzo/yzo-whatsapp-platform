import {
    createContact, getContactById, updateContact,
    deleteContact, blockContact, unblockContact, getUnassignedContacts,
    findTenantUser, findContactsByIds, assignMultipleContacts,
    getContactsByIds, getContactsWithTags, assignContactToUser,
    getLeastLoadedUser, getAllActiveUsers
} from './contactCrudService.js';
import { getUsersByTagId } from '../tags/tagCrudService.js';
import { loginUser } from '../users/userController.js';





export const userCreateContact = async (data, tenantId, userId) => {
    return await createContact(data, tenantId, userId);
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



// ===================== GET CONTACTS BY USER ID =====================
export const getContactsByUserId = async (tenantId, userId, page = 1, limit = 20, search = '') => {
    if (!tenantId) throw new Error('Tenant ID is required');
    if (!userId) throw new Error('User ID is required');

    // 1. Build Filter: Must belong to Tenant AND be assigned to this User
    const whereClause = {
        tenantId: tenantId,
        assignedTo: userId,
        isActive: true, // Optional: only show active contacts
    };

    // Add search filter if provided
    if (search) {
        whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } }
        ];
    }

    // Pagination math
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // 2. Get Total Count (for pagination info)
    const totalContacts = await prisma.contact.count({
        where: whereClause,
    });

    // 3. Fetch Contacts with Tags included
    const contacts = await prisma.contact.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
            contactTags: {
                include: { tag: true } // Include tag names
            }
        }
    });

    return {
        message: `Found ${totalContacts} contacts for this user`,
        count: totalContacts,
        totalPages: Math.ceil(totalContacts / limit),
        currentPage: parseInt(page),
        contacts,
    };
};



//Assign multiple contacts
export const userAssignMultipleContacts = async (contactIds, userId, tenantId) => {
    // 1. Validation
    const user = await findTenantUser(userId, tenantId);
    if (!user) throw new Error("User not found");

    // 2. Fetch contacts
    const contacts = await getContactsByIds(contactIds, tenantId);

    // 3. Logic: Check for Scenario 3 (Assigned to another user)
    // const conflict = contacts.find(c => c.assignedTo !== null && c.assignedTo !== userId);
    // if (conflict) {
    //     return { message: `Contacts are assigned to another user (${conflict.assignedTo})` };
    // }

    // 4. Logic: Check for Scenario 2 (Already assigned to same user)
    const alreadyAssigned = contacts.every(c => c.assignedTo === userId);
    if (alreadyAssigned) {
        return { message: "Contacts are already assigned to the same user" };
    }

    // 5. Scenario 1: Assign them (Success)
    await updateContactsBatch(contactIds, userId);
    return { message: `Successfully assigned ${contactIds.length} contact(s) to user ${userId}` };
};



// ======== Manual Priority Assignment using Tag-User Mapping.========
// - Highest priority tag is checked first
// - If multiple users exist for that tag → Round Robin
// - If no users exist for that tag → try next tag
// - If no users exist for any tag → keep contact unassigned
export const assignByPriority = async (contactIds, tenantId) => {
    // 1. Fetch contacts with their tags
    const contacts = await getContactsWithTags(contactIds, tenantId);

    if (contacts.length === 0) {
        // throw new Error("No contacts found");
        return {
            sucess: 0,
            failed: 0,
            assignments: [],
            errors: []
        };
    }

    const results = [];
    const errors = [];

    // 2. Process each contact
    for (const contact of contacts) {
        try {
            // Check if already assigned
            if (contact.assignedTo) {
                errors.push({
                    contactId: contact.id,
                    name: contact.name,
                    reason: `Already assigned to user ${contact.assignedTo}`
                });
                continue;
            }

            // 3. Get tags sorted by priority (1 is highest)
            const tags = contact.contactTags
                .map(ct => ct.tag)
                .filter(tag => tag !== null)
                .sort((a, b) => a.priority - b.priority);


            if (tags.length === 0) {
                console.log(`⏸️ ${contact.name} has no tag. Leaving unassigned.`);
                errors.push({
                    contactId: contact.id,
                    name: contact.name,
                    reason: 'No tag found. Contact left unassigned.'
                });

                continue;
            }


            const highestPriorityTag = tags[0];

            // 5. Find users mapped to this tag
            const eligibleUsers = await getUsersByTagId(highestPriorityTag.id, tenantId);

            if (eligibleUsers.length === 0) {
                console.log(` No users for tag '${highestPriorityTag.name}'. Leaving unassigned.`);

                errors.push({
                    contactId: contact.id,
                    name: contact.name,
                    reason: `No users mapped for tag: ${highestPriorityTag.name}.Contact left unassigned.`
                });
                continue;
            }



            if (eligibleUsers.length === 1) {
                // ─────────────────────────────────────
                // ONLY ONE USER → Direct Assignment
                // ─────────────────────────────────────
                selectedUserId = eligibleUsers[0].id;
                assignmentMethod = 'Direct (Single user for tag)';

            } else {
                // ─────────────────────────────────────
                // MULTIPLE USERS → Round Robin within group
                // ─────────────────────────────────────
                const eligibleUserIds = eligibleUsers.map(u => u.id);
                selectedUserId = await getLeastLoadedUser(eligibleUserIds, tenantId);
                assignmentMethod = `Round Robin (Tag: ${highestPriorityTag.name})`;

            }

            // 4. Assign contact to selected user
            await assignContactToUser(contact.id, selectedUserId);

            console.log(`✅ ${contact.name} → ${selectedUserId} (${assignmentMethod})`);

            results.push({
                contactId: contact.id,
                contactName: contact.name,
                assignedTo: selectedUserid,
                // assignedToName: selectedUser.name,
                tag: tagName,
                // priority: highestPriorityTag.priority
                method: assignmentMethod
            });

        } catch (error) {
            errors.push({
                contactId: contact.id,
                name: contact.name,
                reason: error.message
            });
        }
    }

    return {
        success: results.length,
        failed: errors.length,
        assignments: results,
        errors: errors
    };
};
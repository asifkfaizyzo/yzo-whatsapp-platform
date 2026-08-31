import prisma from '../../config/prisma.js';
import fs from 'fs';
import csv from 'csv-parser';




export const createContact = async (data, tenantId, userId) => {
    const { name, phone, email, company, countryCode, tags, tagIds } = data;

    if (!name || !phone) throw new Error('Name and phone are required');
    if (!tenantId) throw new Error('Tenant ID is required');

    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits) throw new Error('Invalid phone number format');

    const formattedPhone = `+${cleanDigits}`;

    const existingContact = await prisma.contact.findUnique({
        where: { phone_tenantId: { phone: formattedPhone, tenantId } }
    });

    if (existingContact) throw new Error('Contact with this phone already exists');

    const whatsappId = cleanDigits.slice(-10);
    const code = countryCode || '+91';

    // Create contact
    const contact = await prisma.contact.create({
        data: {
            name,
            phone: formattedPhone,
            email,
            company,
            countryCode: code,
            whatsappId,
            tenantId,
            assignedTo: userId || null,
            assignedAt: userId ? new Date() : null
        }
    });

    // Handle tags
    let tagIdentifiers = [];
    if (tagIds && tagIds.length > 0) {
        tagIdentifiers = tagIds;
    } else if (tags) {
        if (Array.isArray(tags)) {
            tagIdentifiers = tags
                .join(',')
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);
        } else if (typeof tags === 'string') {
            tagIdentifiers = tags.split(',').map(t => t.trim()).filter(Boolean);
        }
    }

    // Map tags to contact
    for (const tagIdentifier of tagIdentifiers) {
        const tag = await prisma.tag.findFirst({
            where: {
                tenantId,
                OR: [
                    { id: tagIdentifier },
                    { name: { equals: tagIdentifier, mode: 'insensitive' } }
                ]
            }
        });

        if (!tag) {
            console.log(`⚠️ Tag '${tagIdentifier}' not found. Skipping...`);
            continue;
        }

        const linkExists = await prisma.contactTagMapping.findUnique({
            where: {
                contactId_tagId: {
                    contactId: contact.id,
                    tagId: tag.id
                }
            }
        });

        if (!linkExists) {
            await prisma.contactTagMapping.create({
                data: { contactId: contact.id, tagId: tag.id }
            });
            console.log(`✅ Tag '${tag.name}' mapped to contact`);
        }
    }

    // ✅ Run cascading priority assignment if created by TENANT
    if (!userId) {
        console.log(`🔄 Running cascading priority assignment for: ${name}`);
        await assignContactByPriority(contact.id, tenantId);
    }

    // Return final contact with all data
    const finalContact = await prisma.contact.findUnique({
        where: { id: contact.id },
        include: {
            contactTags: {
                include: { tag: true }
            },
            assignedUser: {
                select: { id: true, name: true, email: true }
            }
        }
    });

    return {
        message: 'Contact created successfully',
        contact: finalContact
    };
};




// ===================== GET ALL CONTACTS =====================
// userId: if provided, only contacts assigned to that user are returned (regular user scope)
export const getAllContacts = async (tenantId, page = 1, limit = 10, search = '', userId = null, filter = 'all') => {

    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    // 1. Build database filter conditions
    const whereClause = {
        tenantId,
        isActive: true,
    };

    // Restrict to assigned contacts when called by a regular user
    if (userId) {
        whereClause.assignedTo = userId;
    } else {
        if (filter === 'assigned') {
            whereClause.assignedTo = { not: null };
        } else if (filter === 'unassigned') {
            whereClause.assignedTo = null;
        }
    }

    // Blocked contacts filter
    if (filter === 'blocked') {
        whereClause.isBlocked = true;
    } else if (filter !== 'all') {
        whereClause.isBlocked = false;
    }

    // If search text is present, filter contacts by name, phone, or email
    if (search) {
        whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } }
        ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    // 2. Query the total matching contacts count (needed for frontend page calculation)
    const totalContacts = await prisma.contact.count({
        where: whereClause,
    });

    // 3. Query only the current page's slice of contacts
    const contacts = await prisma.contact.findMany({
        where: whereClause,
        orderBy: {
            createdAt: 'desc',
        },
        skip,
        take,
        include: {
            contactTags: {
                include: { tag: true }
            }
        }
    });

    return {
        message: 'Contacts fetched successfully',
        count: totalContacts,
        totalPages: Math.ceil(totalContacts / limit),
        currentPage: page,
        limit,
        contacts,
    };
}



// ===================== GET CONTACT BY ID =====================
export const getContactById = async (contactId, tenantId) => {
    if (!contactId) throw new Error('Contact ID is required');

    const contact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            tenantId: tenantId
        },
        include: {
            contactTags: {
                include: { tag: true }
            }
        }
    });

    if (!contact) throw new Error('Contact not found');

    return {
        message: 'Contact fetched successfully',
        contact
    };
};



// ===================== GET CONTACTS BY USER ID =====================
export const getContactsByUserId = async (tenantId, userId) => {
    console.log(`🔍 Fetching contacts for User: ${userId}, Tenant: ${tenantId}`);

    const contacts = await prisma.contact.findMany({
        where: {
            tenantId: tenantId,
            assignedTo: userId
        },
        orderBy: { createdAt: 'desc' },
        include: {
            contactTags: {
                include: { tag: true }
            }
        }
    });

    console.log(`✅ Found ${contacts.length} contacts`);
    console.log(`📋 Contacts:`, contacts.map(c => c.name));

    return {
        message: `Found ${contacts.length} contacts`,
        count: contacts.length,
        contacts
    };
};



// ===================== UPDATE CONTACT =====================
export const updateContact = async (contactId, tenantId, data) => {

    if (!contactId) {
        throw new Error('Contact ID is required');
    }

    // Check exists
    const existingContact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            tenantId,
        },
    });

    if (!existingContact) {
        throw new Error('Contact not found');
    }

    // Prepare update
    const updateData = {};

    if (data.name) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.countryCode !== undefined) updateData.countryCode = data.countryCode;

    // Phone update with duplicate check
    if (data.phone) {
        const cleanDigits = data.phone.replace(/\D/g, '');
        if (!cleanDigits) {
            throw new Error('Invalid phone number format');
        }
        const formattedPhone = `+${cleanDigits}`;

        const duplicatePhone = await prisma.contact.findFirst({
            where: {
                phone: formattedPhone,
                tenantId,
                id: { not: contactId },
            },
        });

        if (duplicatePhone) {
            throw new Error('Contact with this phone already exists');
        }

        updateData.phone = formattedPhone;
        updateData.whatsappId = cleanDigits;
    }

    if (Object.keys(updateData).length > 0) {
        await prisma.contact.update({
            where: { id: contactId },
            data: updateData,
        });
    }

    // Handle tag mappings updates
    if (data.tags !== undefined) {
        // Clear existing mappings
        await prisma.contactTagMapping.deleteMany({
            where: { contactId }
        });

        const tagIdentifiers = data.tags || [];
        if (tagIdentifiers.length > 0) {
            for (const tagIdentifier of tagIdentifiers) {
                let tag;
                if (tagIdentifier.startsWith('c') && tagIdentifier.length > 20) {
                    tag = await prisma.tag.findFirst({
                        where: { id: tagIdentifier, tenantId }
                    });
                } else {
                    tag = await prisma.tag.findFirst({
                        where: {
                            tenantId,
                            name: { equals: tagIdentifier, mode: 'insensitive' }
                        }
                    });
                }

                if (!tag) {
                    console.log(`⚠️ Tag '${tagIdentifier}' not found during update. Skipping...`);
                    continue;
                }

                await prisma.contactTagMapping.create({
                    data: {
                        contactId: contactId,
                        tagId: tag.id
                    }
                });
            }
        }
    }

    // Return updated contact with its tags and assigned user
    const contactWithTags = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
            contactTags: {
                include: { tag: true }
            },
            assignedUser: {
                select: { id: true, name: true, email: true }
            }
        }
    });

    return {
        message: 'Contact updated successfully',
        contact: contactWithTags,
    };
};



// ===================== DELETE CONTACT =====================
export const deleteContact = async (contactId, tenantId) => {

    if (!contactId) {
        throw new Error('Contact ID is required');
    }

    const existingContact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            tenantId,
        },
    });

    if (!existingContact) {
        throw new Error('Contact not found');
    }

    // Delete tag mappings, conversation, broadcast recipient mappings, and the contact in a transaction to satisfy foreign key constraints
    await prisma.$transaction([
        prisma.contactTagMapping.deleteMany({
            where: { contactId }
        }),
        prisma.broadcastRecipient.deleteMany({
            where: { contactId }
        }),
        prisma.conversation.deleteMany({
            where: { contactId }
        }),
        prisma.contact.delete({
            where: { id: contactId }
        })
    ]);

    return {
        message: 'Contact deleted successfully',
    };
};



// ===================== BULK DELETE CONTACTS =====================
export const bulkDeleteContacts = async ({ mode, contactIds, filters, confirmation }, tenantId) => {
    if (!tenantId) throw new Error('Tenant ID is required');

    let idsToDelete = [];

    if (mode === 'selected') {
        if (!contactIds || contactIds.length === 0) throw new Error('No contact IDs provided');
        const found = await prisma.contact.findMany({ where: { id: { in: contactIds }, tenantId }, select: { id: true } });
        idsToDelete = found.map(c => c.id);
    } 
    else if (mode === 'filter') {
        const whereClause = { tenantId };

        if (filters) {
            if (filters.startDate || filters.endDate) {
                whereClause.createdAt = {};
                if (filters.startDate) whereClause.createdAt.gte = new Date(filters.startDate);
                if (filters.endDate) {
                    const end = new Date(filters.endDate);
                    end.setHours(23, 59, 59, 999);
                    whereClause.createdAt.lte = end;
                }
            }
            if (filters.assignedFilter === 'assigned') whereClause.assignedTo = { not: null };
            if (filters.assignedFilter === 'unassigned') whereClause.assignedTo = null;
            if (filters.search) {
                whereClause.OR = [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { phone: { contains: filters.search } },
                    { email: { contains: filters.search, mode: 'insensitive' } }
                ];
            }
            // Target Corrupted Data without raw SQL
            if (filters.invalidOnly) {
                whereClause.OR = [
                    { phone: { contains: 'E+' } },
                    { phone: { contains: 'e+' } },
                    { name: { equals: '' } }
                ];
            }
        }

        const found = await prisma.contact.findMany({ where: whereClause, select: { id: true } });
        idsToDelete = found.map(c => c.id);
    } 
    else if (mode === 'all') {
        if (confirmation !== 'DELETE ALL') throw new Error('Confirmation "DELETE ALL" required');
        const found = await prisma.contact.findMany({ where: { tenantId }, select: { id: true } });
        idsToDelete = found.map(c => c.id);
    }

    if (idsToDelete.length === 0) return { message: 'No contacts found to delete', deletedCount: 0 };

    const CHUNK_SIZE = 500;
    let totalDeleted = 0;

    for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
        const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
        await prisma.$transaction([
            prisma.contactTagMapping.deleteMany({ where: { contactId: { in: chunk } } }),
            prisma.broadcastRecipient.deleteMany({ where: { contactId: { in: chunk } } }),
            prisma.conversation.deleteMany({ where: { contactId: { in: chunk } } }),
            prisma.contact.deleteMany({ where: { id: { in: chunk }, tenantId } })
        ]);
        totalDeleted += chunk.length;
    }

    return { message: `Successfully deleted ${totalDeleted} contact(s)`, deletedCount: totalDeleted };
};


// ===================== BLOCK CONTACT =====================
export const blockContact = async (contactId, tenantId) => {

    if (!contactId) {
        throw new Error('Contact ID is required');
    }

    const contact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            tenantId,
        },
    });

    if (!contact) {
        throw new Error('Contact not found');
    }

    if (contact.isBlocked) {
        throw new Error('Contact is already blocked');
    }

    const blockedContact = await prisma.contact.update({
        where: { id: contactId },
        data: { isBlocked: true },
    });

    return {
        message: 'Contact blocked successfully',
        contact: blockedContact,
    };
};



// ===================== UNBLOCK CONTACT =====================
export const unblockContact = async (contactId, tenantId) => {

    if (!contactId) {
        throw new Error('Contact ID is required');
    }

    const contact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            tenantId,
        },
    });

    if (!contact) {
        throw new Error('Contact not found');
    }

    if (!contact.isBlocked) {
        throw new Error('Contact is not blocked');
    }

    const unblockedContact = await prisma.contact.update({
        where: { id: contactId },
        data: { isBlocked: false },
    });

    return {
        message: 'Contact unblocked successfully',
        contact: unblockedContact,
    };
};




//bulk CSV contact importer function
// ===================== IMPORT CSV =====================
// ===================== IMPORT CSV =====================
export const importContactsFromCSV = async (filePath, tenantId) => {
    if (!filePath || !tenantId) throw new Error('Missing file or Tenant ID');

    const deleteTempFile = () => fs.existsSync(filePath) && fs.unlinkSync(filePath);

    try {
        const rows = await new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(filePath)
                .pipe(csv()) // ✅ Dynamic parsing, stops column shift
                .on('data', (row) => results.push(row))
                .on('end', () => resolve(results))
                .on('error', reject);
        });

        const summary = { total: rows.length, created: 0, duplicates: 0, errors: 0, createdContacts: [], duplicateContacts: [], errorDetails: [], assignments: [] };
        let rowIndex = 1;

        for (const row of rows) {
            rowIndex++;
            try {
                const normalized = {};
                Object.keys(row).forEach(k => { if (k) normalized[k.toLowerCase().trim()] = row[k]; });

                const name = normalized.name?.trim();
                const rawPhone = normalized.phone?.trim() || '';
                
                // 🔴 Reject Missing
                if (!name || !rawPhone) {
                    summary.errors++; summary.errorDetails.push({ name: name||'Unknown', phone: rawPhone||'Empty', reason: 'Missing Name/Phone' }); continue;
                }
                // 🔴 Reject Excel E+ notation
                if (/e\+/i.test(rawPhone)) {
                    summary.errors++; summary.errorDetails.push({ name, phone: rawPhone, reason: 'Scientific notation (E+). Format as Text in Excel.' }); continue;
                }
                // 🔴 Reject Letters
                if (/[a-zA-Z]/.test(rawPhone)) {
                    summary.errors++; summary.errorDetails.push({ name, phone: rawPhone, reason: 'Phone contains letters' }); continue;
                }

                const cleanDigits = rawPhone.replace(/\D/g, '');
                if (cleanDigits.length < 8 || cleanDigits.length > 15) {
                    summary.errors++; summary.errorDetails.push({ name, phone: rawPhone, reason: 'Invalid phone length' }); continue;
                }

                const formattedPhone = `+${cleanDigits}`;
                const existing = await prisma.contact.findUnique({ where: { phone_tenantId: { phone: formattedPhone, tenantId } } });

                let contactId;
                if (existing) {
                    summary.duplicates++; summary.duplicateContacts.push({ name, phone: formattedPhone }); contactId = existing.id;
                } else {
                    const newC = await prisma.contact.create({
                        data: { name, phone: formattedPhone, email: normalized.email, company: normalized.company, countryCode: normalized.countrycode || '+91', whatsappId: cleanDigits.slice(-10), tenantId }
                    });
                    summary.created++; summary.createdContacts.push(newC); contactId = newC.id;
                }

                // Tags
                if (normalized.tags) {
                    for (const t of normalized.tags.split(',')) {
                        const tag = await prisma.tag.findFirst({ where: { tenantId, name: { equals: t.trim(), mode: 'insensitive' } } });
                        if (tag) {
                            await prisma.contactTagMapping.create({ data: { contactId, tagId: tag.id } }).catch(() => {}); // catch unique constraint if exists
                        }
                    }
                }
            } catch (err) {
                summary.errors++; summary.errorDetails.push({ name: row.name||'Unknown', phone: row.phone||'Unknown', reason: err.message });
            }
        }

        // Auto Assign
        for (const c of summary.createdContacts) {
            await assignContactByPriority(c.id, tenantId).catch(console.error);
        }

        deleteTempFile();
        return { message: 'Import complete', summary };
    } catch (err) {
        deleteTempFile(); throw err;
    }
};




// ======== Cascading Priority + Round Robin Assignment ========
export const assignContactByPriority = async (contactId, tenantId) => {

    // 1. Fetch contact with sorted tags
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
            contactTags: {
                include: { tag: true },
                orderBy: { tag: { priority: 'asc' } } // ✅ Sort in DB query
            }
        }
    });

    if (!contact || contact.contactTags.length === 0) {
        return { assignedTo: null, method: 'Unassigned (No tags)' };
    }

    // 2. Cascading: Try each tag
    for (const { tag } of contact.contactTags) {
        const userMappings = await prisma.userTagMapping.findMany({
            where: { tagId: tag.id, tenantId }
        });

        if (userMappings.length === 0) continue; // Try next tag

        // 3. Round Robin within tag group
        const selectedUserId = await getLeastLoadedUser(
            userMappings.map(m => m.userId),
            tenantId
        );

        // 4. Assign
        await prisma.contact.update({
            where: { id: contactId },
            data: { assignedTo: selectedUserId, assignedAt: new Date() }
        });

        return {
            assignedTo: selectedUserId,
            tag: tag.name,
            method: userMappings.length === 1
                ? `Direct Assignment (Tag: ${tag.name})`
                : `Round Robin (Tag: ${tag.name})`
        };
    }

    // 5. No users found for any tag
    return { assignedTo: null, method: 'Unassigned (No users mapped to any tag)' };
};




// ======== Round Robin Helper ========
// Find the user who currently has the least number of assigned contacts
// This is the core logic used for balanced distribution
// ✅ NEW: Fast single-query aggregation
export const getLeastLoadedUser = async (userIds, tenantId) => {
    const userCounts = await prisma.contact.groupBy({
        by: ['assignedTo'],
        where: {
            assignedTo: { in: userIds },
            tenantId: tenantId
        },
        _count: {
            assignedTo: true
        }
    });

    // Create count map for quick lookup
    const countMap = {};
    userIds.forEach(id => { countMap[id] = 0; });
    userCounts.forEach(item => {
        if (item.assignedTo) {
            countMap[item.assignedTo] = item._count.assignedTo;
        }
    });

    // Pick the user ID with the lowest contact count
    const sortedUserIds = [...userIds].sort((a, b) => countMap[a] - countMap[b]);
    return sortedUserIds[0];
};

// ======== Get All Active Users Under Tenant (Fallback) ========
export const getAllActiveUsers = async (tenantId) => {
    return await prisma.user.findMany({
        where: {
            tenantId: tenantId,
            isActive: true
        },
        select: {
            id: true,
            name: true
        }
    });
};




// get un-assigned contacts by the tenant
export const getUnassignedContacts = async (tenantId) => {
    return await prisma.contact.findMany({
        where: {
            tenantId: tenantId,
            assignedTo: null
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};



// Find contacts by IDs(manual user assignment)
export const findContactsByIds = async (contactIds, tenantId) => {
    return await prisma.contact.findMany({
        where: {
            id: { in: contactIds },
            tenantId: tenantId
        },
        select: {
            id: true,
            assignedTo: true
        }
    });
};


// ======== Assign Multiple Contacts to a Single User under Tenant (MANUAL)========
// 1. Assign multiple contacts to user(Batch update contacts to a single user)
export const assignMultipleContacts = async (contactIds, userId) => {
    return await prisma.contact.updateMany({
        where: {
            id: { in: contactIds }
        },
        data: {
            assignedTo: userId,
            assignedAt: new Date()
        }
    });
};
//2. Check if user belongs to this tenant
export const findTenantUser = async (userId, tenantId) => {
    return await prisma.user.findFirst({
        where: {
            id: userId,
            tenantId: tenantId
        }
    });
};
//3. Fetch contacts with basic info (no tags)
export const getContactsByIds = async (contactIds, tenantId) => {
    return await prisma.contact.findMany({
        where: {
            id: { in: contactIds },
            tenantId: tenantId
        }
    });
};



//========SINGLE ASSIGNMENT USER TO CONTACT========
//Assign ONE contact to ONE user (single update)
export const assignContactToUser = async (contactId, userId) => {
    return await prisma.contact.update({
        where: { id: contactId },
        data: {
            assignedTo: userId,
            assignedAt: new Date()
        }
    });
};

//Add tag to a conact
export const addTagToContact = async (contactId, tagId) => {
    return await prisma.contactTagMapping.create({
        data: { contactId, tagId }
    });
};

//Remove tag from a contact
export const removeTagFromContact = async (contactId, tagId) => {
    return await prisma.contactTagMapping.deleteMany({
        where: { contactId, tagId }
    });
};

//Fetch contacts with their tags(for priority assignment)
export const getContactsWithTags = async (contactIds, tenantId) => {
    return await prisma.contact.findMany({
        where: { id: { in: contactIds }, tenantId },
        include: {
            contactTags: {
                include: { tag: true }
            }
        }
    });
};



//========Priority-Based Assignment using Tag-User Mapping.========
// Check if contact has this specific tag
export const checkContactTagMapping = async (contactId, tagId) => {
    return await prisma.contactTagMapping.findUnique({
        where: {
            contactId_tagId: {
                contactId: contactId,
                tagId: tagId
            }
        }
    });
};

// Check if contact has any tags
export const getContactTags = async (contactId) => {
    return await prisma.contactTagMapping.findMany({
        where: { contactId },
        include: { tag: true }
    });
};

// Get tag details
export const getTagById = async (tagId) => {
    return await prisma.tag.findUnique({
        where: { id: tagId }
    });
}; 
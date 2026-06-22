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
                name: { equals: tagIdentifier, mode: 'insensitive' }
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

    // Delete tag mappings, conversation, and the contact in a transaction to satisfy foreign key constraints
    await prisma.$transaction([
        prisma.contactTagMapping.deleteMany({
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
export const importContactsFromCSV = async (filePath, tenantId) => {
    console.log(`🚀 Starting CSV Import for Tenant: ${tenantId}`);

    if (!filePath) throw new Error('CSV file path is missing');
    if (!tenantId) throw new Error('Tenant ID is missing');

    // 1. Read CSV
    const rows = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv({
                headers: ['name', 'phone', 'email', 'company', 'countryCode', 'tags'], // ✅ Inline,    // ✅ Tell parser what headers to use
                skipLines: 1         // ✅ Skip the first row (since we defined headers manually)
            }))
            .on('data', (row) => {
                console.log('🔄 Raw row:', row);
                results.push(row);
            })
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });

    console.log(`✅ Parsed ${rows.length} rows from CSV.`);

    const summary = {
        total: rows.length,
        created: 0,
        duplicates: 0,
        errors: 0,
        createdContacts: [],
        duplicateContacts: [],
        errorDetails: [],
        assignments: []         // ✅ Track assignments
    };

    // 2. Process Loop
    for (const row of rows) {
        try {

            console.log('🔄 Raw row:', row); // Debug: see actual keys

            // Normalize all keys to lowercase
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
                normalizedRow[key.toLowerCase().trim()] = row[key];
            });

            const name = normalizedRow.name?.trim();
            const rawPhone = normalizedRow.phone?.trim();
            const phone = rawPhone ? rawPhone.replace(/[-\s]/g, '') : '';
            const email = normalizedRow.email?.trim() || null;
            const company = normalizedRow.company?.trim() || null;
            const countryCode = normalizedRow.countrycode?.trim() || '+91';
            const tagNames = normalizedRow.tags
                ? normalizedRow.tags.split(',').map(t => t.trim()).filter(Boolean)
                : [];

            console.log(`🏷️ Tags: ${tagNames}`);

            if (!name || !phone) {
                console.log('⚠️ Missing name or phone. Skipping...');
                summary.errors++;
                summary.errorDetails.push({
                    name: name || 'Unknown',
                    reason: 'Missing Name or Phone'
                });
                continue;
            }

            // Check Duplicate
            const existing = await prisma.contact.findUnique({
                where: { phone_tenantId: { phone, tenantId } }
            });

            let currentContactId;

            if (existing) {
                summary.duplicates++;
                summary.duplicateContacts.push({
                    name,
                    phone,
                    reason: 'Already exists'
                });
                currentContactId = existing.id;
            } else {
                // WhatsApp ID: Only last 10 digits
                const whatsappId = phone.replace(/\D/g, '').slice(-10);

                const newContact = await prisma.contact.create({
                    data: {
                        name,
                        phone,
                        email,
                        company,
                        countryCode,
                        whatsappId,
                        tenantId,
                        isActive: true,
                        isBlocked: false
                    }
                });

                currentContactId = newContact.id;
                summary.created++;
                summary.createdContacts.push({
                    id: newContact.id,
                    name,
                    phone,
                    whatsappId
                });
            }

            // ✅ Handle Tags: ONLY use existing tags, NO new tag creation
            // --- D. Handle Tags ---
            for (const tagName of tagNames) {

                // ✅ Try multiple formats to find the tag
                const normalizedTagName = tagName.charAt(0).toUpperCase() + tagName.slice(1).toLowerCase();

                console.log(`🔍 Looking for tag: "${tagName}" → normalized: "${normalizedTagName}"`);

                // Try to find tag (case insensitive search)
                const tag = await prisma.tag.findFirst({
                    where: {
                        tenantId: tenantId,
                        name: {
                            equals: tagName,
                            mode: 'insensitive'  // ✅ Case insensitive match
                        }
                    }
                });

                if (!tag) {
                    console.log(`⚠️ Tag '${tagName}' not found in DB. Skipping...`);
                    continue;
                }

                console.log(`✅ Found tag: ${tag.name} (ID: ${tag.id})`);

                // Check if mapping already exists
                const linkExists = await prisma.contactTagMapping.findUnique({
                    where: {
                        contactId_tagId: {
                            contactId: currentContactId,
                            tagId: tag.id
                        }
                    }
                });

                if (!linkExists) {
                    await prisma.contactTagMapping.create({
                        data: {
                            contactId: currentContactId,
                            tagId: tag.id
                        }
                    });
                    console.log(`✅ Mapped contact to tag '${tag.name}'`);
                } else {
                    console.log(`ℹ️ Mapping already exists for tag '${tag.name}'`);
                }
            }

        } catch (error) {
            summary.errors++;
            summary.errorDetails.push({
                name: row.name || 'Unknown',
                phone: row.phone || 'Unknown',
                reason: error.message
            });
        }
    }

    // ✅ Auto Priority Assignment for New Contacts
   // ✅ Cascading Priority Assignment for CSV contacts
if (summary.createdContacts.length > 0) {
    console.log(`🔄 Running cascading priority assignment for ${summary.createdContacts.length} contacts...`);

    for (const createdContact of summary.createdContacts) {
        try {
            if (!createdContact?.id) continue;

            // ✅ Use the shared helper function
            const result = await assignContactByPriority(
                createdContact.id,
                tenantId
            );

            summary.assignments.push({
                contactId: createdContact.id,
                contactName: createdContact.name,
                assignedTo: result?.assignedTo || null,
                tag: result?.tag || 'No Tag',
                method: result?.method || 'Unassigned'
            });

        } catch (err) {
            console.error(`❌ Error assigning ${createdContact?.name}:`, err.message);
        }
    }
}
    console.log('🏁 Import Summary:', summary);
    return { message: 'CSV import completed', summary };
}


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
export const getLeastLoadedUser = async (userIds, tenantId) => {
    // Count how many contacts each user has
    const userLoads = await Promise.all(
        userIds.map(async (userId) => {
            const count = await prisma.contact.count({
                where: {
                    assignedTo: userId,
                    tenantId: tenantId
                }
            });
            return { userId, count };
        })
    );

    console.log('👥 User loads:', userLoads);

    // Sort by count (ascending) and pick the least loaded
    userLoads.sort((a, b) => a.count - b.count);

    return userLoads[0].userId; // Return userId with least contacts
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
import prisma from '../../config/prisma.js';
import fs from 'fs';
import csv from 'csv-parser';




export const createContact = async (data, tenantId, userId) => {

    // ✅ Destructure tagIds too
    const { name, phone, email, company, tags, tagIds, countryCode } = data;
    
    console.log('📋 Creating contact with data:', { name, phone, tags, tagIds, userId });

    if (!name || !phone) throw new Error('Name and phone are required');
    if (!tenantId) throw new Error('Tenant ID is required');

    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits) throw new Error('Invalid phone number format');

    const formattedPhone = `+${cleanDigits}`;

    const existingContact = await prisma.contact.findUnique({
        where: {
            phone_tenantId: { phone: formattedPhone, tenantId }
        }
    });

    if (existingContact) throw new Error('Contact with this phone already exists');

    const whatsappId = cleanDigits.slice(-10);
    const code = countryCode || '+91';

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

    console.log('✅ Contact created:', contact.id);

    // ✅ Handle both tagIds and tags
    const tagIdentifiers = tagIds || tags || [];
    console.log('🏷️ Tag identifiers:', tagIdentifiers);

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

            console.log(`🔍 Tag found:`, tag?.name || 'NOT FOUND');

            if (!tag) {
                console.log(`⚠️ Tag '${tagIdentifier}' not found. Skipping...`);
                continue;
            }

            await prisma.contactTagMapping.create({
                data: {
                    contactId: contact.id,
                    tagId: tag.id   // ✅ tag.id not tagId
                }
            });

            console.log(`✅ Tag '${tag.name}' mapped to contact`);
        }
    }

    // Return contact with tags
    const contactWithTags = await prisma.contact.findUnique({
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
        contact: contactWithTags  // ✅ Return contactWithTags not contact
    };
};


// ===================== GET ALL CONTACTS =====================
export const getAllContacts = async (tenantId) => {
if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    // 1. Build database filter conditions
    const whereClause = {
        tenantId,
        isActive: true,
    };

    // If search text is present, filter contacts by name, phone, or email
    if (search) {
        whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } }
        ];
    }

    // const skip = (2 - 1) * 10
    // const debugskip = 10
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
    if (data.tags !== undefined) updateData.tags = data.tags;
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

    if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
    }

    const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: updateData,
    });

    return {
        message: 'Contact updated successfully',
        contact: updatedContact,
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

    await prisma.contact.delete({
        where: { id: contactId },
    });

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
            .pipe(csv())
            .on('data', (row) => results.push(row))
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
            const name = row.name?.trim();
            const rawPhone = row.phone?.trim();
            const phone = rawPhone ? rawPhone.replace(/[-\s]/g, '') : '';
            const email = row.email?.trim() || null;
            const company = row.company?.trim() || null;
            const countryCode = row.countryCode?.trim() || '+91';

            const tagNames = row.tags
                ? row.tags.split(',').map(t => t.trim()).filter(Boolean)
                : [];

            if (!name || !phone) {
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
    if (summary.createdContacts.length > 0) {
        console.log(`🔄 Running priority assignment...`);

        for (const createdContact of summary.createdContacts) {
            const contact = await prisma.contact.findUnique({
                where: { id: createdContact.id },
                include: {
                    contactTags: {
                        include: { tag: true }
                    }
                }
            });

            if (!contact || contact.contactTags.length === 0) continue;

            // Get highest priority tag
            const topTag = contact.contactTags
                .map(ct => ct.tag)
                .sort((a, b) => a.priority - b.priority)[0];

            // Find user mapped to this tag
            const userMapping = await prisma.userTagMapping.findFirst({
                where: {
                    tagId: topTag.id,
                    tenantId: tenantId
                }
            });

            if (!userMapping) continue;

            // ✅ Update assignedTo in DB
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    assignedTo: userMapping.userId,
                    assignedAt: new Date()
                }
            });

            console.log(`✅ ${contact.name} → assigned to ${userMapping.userId}`);

            summary.assignments.push({
                contactId: contact.id,
                contactName: contact.name,
                assignedTo: userMapping.userId,
                tag: topTag.name,
                priority: topTag.priority
            });
        }
    }

    // Cleanup
    try {
        fs.unlinkSync(filePath);
    } catch (e) {
        console.warn('Could not delete CSV file:', e.message);
    }

    console.log('🏁 Import Summary:', summary);
    return { message: 'CSV import completed', summary };
}






// get un- assigned contacts by the tenant
export const getUnassignedContacts = async (tenantId) => {
    return await prisma.contact.findMany({  
        where: {
            tenantId  : tenantId,
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
            id      : { in: contactIds },
            tenantId: tenantId
        },
        select: {
            id        : true,
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
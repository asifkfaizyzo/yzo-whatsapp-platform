import prisma from '../../config/prisma.js';
import fs from 'fs';
import csv from 'csv-parser';



// ===================== CREATE CONTACT =====================
export const createContact = async (data, tenantId) => {

    const { name, phone, email, company, tags, countryCode } = data;

    if (!name || !phone) {
        throw new Error('Name and phone are required');
    }

    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    // Extract digits only from the phone number
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits) {
        throw new Error('Invalid phone number format');
    }

    // Format phone with + prefix (E.164)
    const formattedPhone = `+${cleanDigits}`;

    // Check duplicate using the full formatted phone number
    const existingContact = await prisma.contact.findUnique({
        where: {
            phone_tenantId: {
                phone: formattedPhone,
                tenantId,
            },
        },
    });

    if (existingContact) {
        throw new Error('Contact with this phone already exists');
    }

    // Generate WhatsApp ID (just the clean digits)
    const whatsappId = cleanDigits;
    const code = countryCode || '+91';

    // Create
    const contact = await prisma.contact.create({
        data: {
            name,
            phone: formattedPhone,
            email,
            company,
            tags: tags || [],
            countryCode: code,
            whatsappId,
            tenantId,
        },
    });

    return {
        message: 'Contact created successfully',
        contact,
    };
};


// ===================== GET ALL CONTACTS =====================
export const getAllContacts = async (tenantId, page = 1, limit = 10, search = '') => {

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
};


// ===================== GET CONTACT BY ID =====================
export const getContactById = async (contactId, tenantId) => {

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

    return {
        message: 'Contact fetched successfully',
        contact,
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

    // 1️⃣ Validate
    if (!filePath) {
        throw new Error('CSV file is required');
    }

    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    // 2️⃣ Read CSV file
    const rows = await new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(filePath)
            .pipe(csv()).on('data', (row) => {
                results.push(row);
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', (error) => {
                reject(error);
            });
    });

    console.log(`Total rows in CSV: ${rows.length}`);

    // 3️⃣ Track results
    const summary = {
        total: rows.length,
        created: 0,
        duplicates: 0,
        errors: 0,
        errorDetails: [],
    };

    // 4️⃣ Process each row
    for (const row of rows) {
        try {
            // Extract fields
            const name = row.name?.trim();
            const phone = row.phone?.trim();
            const email = row.email?.trim() || null;
            const company = row.company?.trim() || null;
            const countryCode = row.countryCode?.trim() || '+91';
            const tags = row.tags
                ? row.tags.split(',').map((t) => t.trim()).filter(Boolean)
                : [];

            console.log(`Processing: ${name} - ${phone}`);

            // 5️⃣ Validate required fields
            if (!name || !phone) {
                summary.errors++;
                summary.errorDetails.push({
                    name: name || 'missing',
                    phone: phone || 'missing',
                    reason: 'Name or phone is missing',
                });
                continue;
            }

            // 6️⃣ Check duplicate
            const existing = await prisma.contact.findUnique({
                where: {
                    phone_tenantId: {
                        phone,
                        tenantId,
                    },
                },
            });

            if (existing) {
                console.log(`Duplicate found: ${phone}`);
                summary.duplicates++;
                continue;
            }

            // 7️⃣ Generate WhatsApp ID
            const whatsappId = countryCode.replace('+', '') + phone;

            // 8️⃣ Create contact
            await prisma.contact.create({
                data: {
                    name,
                    phone,
                    email,
                    company,
                    countryCode,
                    whatsappId,
                    tags,
                    tenantId,
                    isActive: true,
                    isBlocked: false,
                },
            });

            summary.created++;
            console.log(`Created: ${name}`);

        } catch (error) {
            summary.errors++;
            summary.errorDetails.push({
                name: row.name || 'unknown',
                phone: row.phone || 'unknown',
                reason: error.message,
            });
            console.error(`Error processing row:`, error.message);
        }
    }

    // 9️⃣ Delete uploaded file after processing
    fs.unlinkSync(filePath);
    console.log('CSV file deleted after processing');

    console.log('Import summary:', summary);

    return {
        message: 'CSV import completed',
        summary,
    };
};


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





// ======== Assign Multiple Contacts to a Single User under Tenant ========
// Find contacts by IDs
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

// Assign contacts
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

export const findTenantUser = async (userId, tenantId) => {
    return await prisma.user.findFirst({
        where: {
            id: userId,
            tenantId: tenantId
        }
    });
};

export const getContactsByIds = async (contactIds, tenantId) => {
    return await prisma.contact.findMany({
        where: {
            id: { in: contactIds },
            tenantId: tenantId
        }
    });
};

export const updateContactsBatch = async (contactIds, userId) => {
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
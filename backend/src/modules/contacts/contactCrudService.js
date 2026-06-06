import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

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

    // Check duplicate
    const existingContact = await prisma.contact.findUnique({
        where: {
            phone_tenantId: {
                phone,
                tenantId,
            },
        },
    });

    if (existingContact) {
        throw new Error('Contact with this phone already exists');
    }

    // Generate WhatsApp ID
    const code = countryCode || '+91';
    const whatsappId = code.replace('+', '') + phone;

    // Create
    const contact = await prisma.contact.create({
        data: {
            name,
            phone,
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
export const getAllContacts = async (tenantId) => {

    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    const contacts = await prisma.contact.findMany({
        where: {
            tenantId,
            isActive: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return {
        message: 'Contacts fetched successfully',
        count: contacts.length,
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
        const duplicatePhone = await prisma.contact.findFirst({
            where: {
                phone: data.phone,
                tenantId,
                id: { not: contactId },
            },
        });

        if (duplicatePhone) {
            throw new Error('Contact with this phone already exists');
        }

        updateData.phone = data.phone;
        const code = data.countryCode || existingContact.countryCode || '+91';
        updateData.whatsappId = code.replace('+', '') + data.phone;
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
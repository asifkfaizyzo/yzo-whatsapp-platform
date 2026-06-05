import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();



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
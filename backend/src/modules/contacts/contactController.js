// modules/contacts/contactController.js

import { userCreateContact } from './userContactService.js';
import prisma from '../../config/prisma.js';
import { assignByPriority } from './userContactService.js';
import {
    createContact, getAllContacts, getContactById, updateContact,
    deleteContact, blockContact, unblockContact, addTagToContact,
    checkContactTagMapping, getContactTags, getTagById, getContactsByUserId,
    importContactsFromCSV, removeTagFromContact,
} from './contactCrudService.js';

import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';

//  1.===================== CREATE CONTACT =====================
export const createContactController = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const userId = req.user?.id;

        console.log('tenantId =>', tenantId);
        console.log('userId =>', userId);

        const result = await userCreateContact(req.body, tenantId, userId);

        return res.status(201).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

// 2.===================== GET ALL CONTACTS =====================
export const getAllContactsController = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const search = req.query.search || '';
        const filter = req.query.filter || 'all';
        const userId = req.userType === 'USER' ? req.user.id : null;

        const result = await getAllContacts(tenantId, page, limit, search, userId, filter);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

//3.===================== GET CONTACT BY ID =====================
export const getContactByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const result = await getContactById(id, tenantId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 4.===================== UPDATE CONTACT =====================
export const updateContactController = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const data = req.body;
        const result = await updateContact(id, tenantId, data);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 5.===================== DELETE CONTACT =====================
export const deleteContactController = async (req, res) => {
    try {
        if (req.userType !== 'TENANT') {
            return res.status(403).json({
                success: false,
                message: "Only tenant admins can delete contacts"
            });
        }
        const { id } = req.params;
        const tenantId = req.tenantId;
        const result = await deleteContact(id, tenantId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 6.===================== BLOCK CONTACT =====================
export const blockContactController = async (req, res) => {
    try {
        if (req.userType !== 'TENANT') {
            return res.status(403).json({
                success: false,
                message: "Only tenant admins can block contacts"
            });
        }
        const { id } = req.params;
        const tenantId = req.tenantId;
        const result = await blockContact(id, tenantId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 7.===================== UNBLOCK CONTACT =====================
export const unblockContactController = async (req, res) => {
    try {
        if (req.userType !== 'TENANT') {
            return res.status(403).json({
                success: false,
                message: "Only tenant admins can unblock contacts"
            });
        }
        const { id } = req.params;
        const tenantId = req.tenantId;
        const result = await unblockContact(id, tenantId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// 8.===================== IMPORT CONTACTS FROM CSV =====================
export const importContactsController = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a CSV file',
            });
        }

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is missing'
            });
        }

        const result = await importContactsFromCSV(req.file.path, tenantId);

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('❌ Import error:', error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ==========================ADD TAG TO CONTACT===========================
export const addTagToContactController = async (req, res, next) => {
    try {
        const { contactId } = req.params;
        const { tagId } = req.body;
        // ✅ FIX: Extract tenantId from request
        const tenantId = req.tenantId;

        const existingMapping = await checkContactTagMapping(contactId, tagId);

        if (existingMapping) {
            return res.status(200).json({
                success: true,
                message: "Contact is already tagged with this tag"
            });
        }

        const otherTags = await getContactTags(contactId);

        if (otherTags.length > 0) {
            const tagNames = otherTags.map((t) => t.tag.name).join(', ');
            return res.status(200).json({
                success: true,
                message: `Contact is already tagged with another tag: ${tagNames}`
            });
        }

        await addTagToContact(contactId, tagId);

        const tag = await getTagById(tagId);

        // ✅ Send notification
        try {
            // ✅ FIX: Only select needed fields, tenantId is now defined
            const contact = await prisma.contact.findFirst({
                where: {
                    id: String(contactId),      // ✅ plain string
                    tenantId: String(tenantId)  // ✅ tenantId is now defined!
                },
                select: { id: true, name: true, phone: true }
            });

            if (tenantId) { // ✅ Only notify if tenantId exists
                const notification = await createNotification({
                    tenantId: String(tenantId),
                    userId: null,
                    type: 'tag_added',
                    title: 'Tag Added',
                    message: `Tag "${tag.name}" added to contact ${contact?.name || contact?.phone || ''}`,
                    metadata: {
                        contactId: String(contactId),
                        tagId: String(tagId),
                        tagName: String(tag.name || ''),
                        contactName: String(contact?.name || contact?.phone || '')
                    }
                });

                emitToTenant(String(tenantId), 'new_notification', { notification });
            }
        } catch (notifyError) {
            console.error('Tag notification error:', notifyError.message);
        }

        return res.status(200).json({
            success: true,
            message: `Contact assigned with tag ${tag.name}`
        });
    } catch (error) {
        next(error);
    }
};

// ===================== GET CONTACTS BY USER =====================
export const getContactsByUser = async (req, res, next) => {
    try {
        const tenantId = req.tenant.id;
        const { userId } = req.params;
        const { page = 1, limit = 20, search = '' } = req.query;

        const result = await getContactsByUserId(
            tenantId,
            userId,
            parseInt(page),
            parseInt(limit),
            search
        );

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

// ===================== ASSIGN CONTACTS BY PRIORITY =====================
export const assignContactsByPriority = async (req, res, next) => {
    try {
        const { contactIds } = req.body;
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant not authenticated',
            });
        }

        const result = await assignByPriority(contactIds, tenantId);

        return res.status(200).json({
            success: true,
            message: `${result.success} contacts assigned by priority`,
            data: result.assignments
        });
    } catch (error) {
        next(error);
    }
};

// ===================== REMOVE TAG FROM CONTACT =====================
export const removeTagFromContactController = async (req, res, next) => {
    try {
        const { contactId, tagId } = req.params;
        // ✅ Extract tenantId properly
        const tenantId = req.tenantId;

          console.log('1️⃣ params =>', { contactId, tagId, tenantId });
        console.log('2️⃣ typeof contactId =>', typeof contactId);
        console.log('3️⃣ typeof tagId =>', typeof tagId);
        console.log('4️⃣ typeof tenantId =>', typeof tenantId);
          console.log('5️⃣ Finding contact...');

        console.log('DELETE tag =>', { contactId, tagId, tenantId });

        // 1. Verify contact belongs to this tenant
        const contact = await prisma.contact.findFirst({
            where: {
                id: String(contactId),      // ✅ plain string
                tenantId: String(tenantId)  // ✅ plain string
            },
            select: { id: true, name: true, phone: true } // ✅ only needed fields
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        // 2. Check if tag mapping exists
        const existingMapping = await checkContactTagMapping(
            String(contactId),
            String(tagId)
        );

        if (!existingMapping) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found on this contact'
            });
        }

        // 3. Remove tag
        await removeTagFromContact(String(contactId), String(tagId));

        // 4. Send notification
        try {
            if (tenantId) { // ✅ Only notify if tenantId exists
                const notification = await createNotification({
                    tenantId: String(tenantId),
                    userId: null,
                    type: 'tag_removed',
                    title: 'Tag Removed',
                    message: `Tag removed from contact ${contact.name || contact.phone || ''}`,
                    metadata: {
                        contactId: String(contactId),
                        tagId: String(tagId),
                        contactName: String(contact.name || contact.phone || '')
                    }
                });

                emitToTenant(String(tenantId), 'new_notification', { notification });
            }
        } catch (notifyError) {
            console.error('Tag notification error:', notifyError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Tag removed from contact successfully'
        });

    } catch (error) {
        console.error('Delete tag error:', error.message);
        next(error);
    }
};
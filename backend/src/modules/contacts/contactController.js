import { importContactsFromCSV } from './contactCrudService.js';
import { userCreateContact } from './userContactService.js';
import { assignByPriority } from './userContactService.js';
import {
    createContact, getAllContacts, getContactById, updateContact,
    deleteContact, blockContact, unblockContact, addTagToContact,
    checkContactTagMapping, getContactTags, getTagById, getContactsByUserId
} from './contactCrudService.js';


//  1.===================== CREATE CONTACT =====================
export const createContactController = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;

        // ✅ Get userId from middleware
        const userId = req.user?.id;

        console.log('tenantId =>', tenantId);
        console.log('userId =>', userId); // Debug: check if userId is set

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

        // Safely parse query parameters with fallbacks to defaults
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const search = req.query.search || '';
        const filter = req.query.filter || 'all';

        // Tenants see all contacts; regular users only see their assigned contacts
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
            return res.status(403).json({ success: false, message: "Only tenant admins can delete contacts" });
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
            return res.status(403).json({ success: false, message: "Only tenant admins can block contacts" });
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
            return res.status(403).json({ success: false, message: "Only tenant admins can unblock contacts" });
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
// =============================== IMPORT CSV ===========================
export const importContactsController = async (req, res) => {
    try {
        // 1️⃣ Get tenantId from middleware
        const tenantId = req.tenant.id;

        // 2️⃣ Check file uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a CSV file',
            });
        }

        console.log('File received:', req.file.originalname);
        console.log('File path:', req.file.path);

        // 3️⃣ Call service
        const result = await importContactsFromCSV(
            req.file.path,
            tenantId,
            userId
        );

        // 4️⃣ Return result
        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
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

        return res.status(200).json({
            success: true,
            message: `Contact assigned with tag ${tag.name}`
        });
    } catch (error) {
        next(error);
    }
};




//get  all contacts under a user
export const getContactsByUser = async (req, res, next) => {
    try {
        const tenantId = req.tenant.id; // From verifyTenant middleware
        const { userId } = req.params;  // From URL: /api/contacts/by-user/:userId
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



//=====================Assign contacts by priority=====================
export const assignContactsByPriority = async (req, res, next) => {
    try {
        const { contactIds } = req.body;
        const tenantId = req.tenant.id;

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
import {
    createContact, getAllContacts, getContactById, updateContact,
    deleteContact, blockContact, unblockContact,
} from './contactCrudService.js';


//Shared Controller
//  1.===================== CREATE CONTACT =====================
export const createContactController = async (req, res) => {
    try {
        const data = req.body;
        const tenantId = req.tenantId;
        const result = await createContact(data, tenantId);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};


// 2.===================== GET ALL CONTACTS =====================
export const getAllContactsController = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const result = await getAllContacts(tenantId);
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
        const { id } = req.params;
        const tenantId = req.tenantId;
        const result = await unblockContact(id, tenantId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
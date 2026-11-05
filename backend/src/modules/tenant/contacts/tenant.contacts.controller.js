// backend/src/modules/tenant/contacts/tenant.contacts.controller.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import {
  assignContactService,
  reassignContactService,
  unassignContactService,
} from "./tenant.contacts.service.js";
import {
  userAssignMultipleContacts,
  assignByPriority,
} from "../../contacts/contact.user.service.js";

export const getUnassigned = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant not authenticated",
      });
    }

    const contacts = await prisma.contact.findMany({
      where: {
        tenantId: tenantId,
        assignedTo: null,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      include: {
        contactTags: {
          include: { tag: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        message: `Found ${contacts.length} unassigned contacts`,
        count: contacts.length,
        contacts,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignMultipleContacts = async (req, res, next) => {
  try {
    const { contactIds, userId } = req.body;
    const result = await userAssignMultipleContacts(
      contactIds,
      userId,
      req.tenantId,
    );
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const assignContactController = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { contactId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required in request body",
      });
    }

    const result = await assignContactService(contactId, userId, tenantId);

    return res.status(200).json({
      success: true,
      message: "Contact assigned successfully",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const reassignContactController = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { contactId } = req.params;
    const { newUserId } = req.body;

    if (!contactId || !newUserId) {
      return res.status(400).json({
        success: false,
        message: "Contact ID and New User ID are required",
      });
    }

    const result = await reassignContactService(contactId, newUserId, tenantId);

    return res.status(200).json({
      success: true,
      message: "Contact reassigned successfully",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const unassignContactController = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { contactId } = req.params;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "Contact ID is required",
      });
    }

    const result = await unassignContactService(contactId, tenantId);

    return res.status(200).json({
      success: true,
      message: "Contact unassigned successfully",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const assignContactsByPriority = async (req, res, next) => {
  try {
    const { contactIds } = req.body;
    const tenantId = req.tenant.id;

    const result = await assignByPriority(contactIds, tenantId);

    return res.status(200).json({
      success: true,
      message: `Processed ${contactIds.length} contacts. ${result.success} assigned, ${result.failed} failed.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

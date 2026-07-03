// modules/tenant/tenantController.js

import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../auth/jwtservice.js';
import { loginUserService } from '../users/userService.js';
import {
    forgotPasswordTenantService,
    resetPasswordTenantService,
} from './tenantService.js';
import {
    userGetUnassignedContacts,
    userAssignMultipleContacts,
    assignByPriority
} from '../contacts/userContactService.js';
import {
    registerTenantService,
    loginTenantService,
    logoutTenantService,
    refreshTenantAccessTokenService,
    createUserService,
    getUsersByTenantService,
    getUserByIdService,
    updateUserByIdService,
    deleteUserByIdService,
    deactivateUserByIdService,
    reactivateUserByIdService,
    assignContactService,
    reassignContactService,
    unassignContactService,
    listConversations,
    getAutoReopenConfigService,
    updateAutoReopenConfigService
} from './tenantService.js';
import { updateTenantByIdService } from '../superadmin/superadminService.js';


// ===================== TENANT AUTH =====================

export const registerTenant = async (req, res) => {
    try {
        const result = await registerTenantService(req.body);
        const { accessToken, refreshToken, user } = result;

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        return res.status(201).json({
            success: true,
            message: 'Tenant registered and logged in successfully',
            data: { user, accessToken },
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const loginTenant = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }

        const tenantExists = await prisma.tenant.findUnique({
            where: { email }
        });

        let result;
        let cookieName; // ← add this ABOVE the if block

        
// ✅ REPLACE WITH
if (tenantExists) {
  result = await loginTenantService(req.body);
  cookieName = 'refreshToken';
} else {
  const userExists = await prisma.user.findUnique({ where: { email } });
  if (userExists) {
    result = await loginUserService(req.body);
    cookieName = 'refreshToken';
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid credentials',
    });
  }
}
const { accessToken, refreshToken, user } = result;
// let cookieName; // ← add this ABOVE the if block

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { user, accessToken }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const logoutTenant = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (refreshToken) {
            await logoutTenantService(refreshToken);
        }

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
        });

        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const refreshTenantAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token not found in cookies or body',
            });
        }

        const result = await refreshTenantAccessTokenService(refreshToken);

        return res.status(200).json({
            success: true,
            message: 'Access token refreshed successfully',
            accessToken: result.accessToken,
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};


// ===================== TENANT PROFILE =====================

export const getLoggedInTenant = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant not authenticated'
            });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                tenantName: true,
                email: true,
                status: true,
                isActive: true,
                phone: true,
                address: true
            },
        });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: tenant
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


export const updateTenantProfile = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const { tenantName, email, phone, address } = req.body;

        const result = await updateTenantByIdService(tenantId, {
            tenantName,
            email,
            phone,
            address,
        });

        return res.status(200).json({
            success: true,
            message: 'Tenant profile updated successfully',
            data: result.tenant,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


// ===================== PASSWORD =====================

export const forgotPasswordTenant = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await forgotPasswordTenantService(email);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const resetPasswordTenant = async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;
        const result = await resetPasswordTenantService(
            token,
            newPassword,
            confirmPassword
        );
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


// ===================== USER MANAGEMENT =====================

export const createUser = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant not authenticated'
            });
        }

        const result = await createUserService(req.body, tenantId);

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const getUsersByTenant = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const result = await getUsersByTenantService(tenantId);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        const result = await getUserByIdService(id, tenantId);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const updateUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        const data = req.body;
        const result = await updateUserByIdService(id, tenantId, data);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const deactivateUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        const result = await deactivateUserByIdService(id, tenantId);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const reactivateUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        const result = await reactivateUserByIdService(id, tenantId);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


export const deleteUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        const result = await deleteUserByIdService(id, tenantId);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


// ===================== CONTACT ASSIGNMENT =====================

export const getUnassigned = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id || req.tenantId;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant not authenticated'
            });
        }

        const contacts = await prisma.contact.findMany({
            where: {
                tenantId: tenantId,
                assignedTo: null,
                isActive: true
            },
            orderBy: { createdAt: 'desc' },
            include: {
                contactTags: {
                    include: { tag: true }
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                message: `Found ${contacts.length} unassigned contacts`,
                count: contacts.length,
                contacts
            }
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
            req.tenantId
        );
        return res.status(200).json({
            success: true,
            message: result.message
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

        // ✅ Validate userId
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required in request body'
            });
        }

        const result = await assignContactService(contactId, userId, tenantId);

        return res.status(200).json({
            success: true,
            message: 'Contact assigned successfully',
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
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
                message: 'Contact ID and New User ID are required',
            });
        }

        const result = await reassignContactService(contactId, newUserId, tenantId);

        return res.status(200).json({
            success: true,
            message: 'Contact reassigned successfully',
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
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
                message: 'Contact ID is required',
            });
        }

        const result = await unassignContactService(contactId, tenantId);

        return res.status(200).json({
            success: true,
            message: 'Contact unassigned successfully',
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


// ===================== CONVERSATIONS =====================

export const listConversationsController = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await listConversations(tenantId, { page, limit });

        return res.status(200).json({
            success: true,
            message: 'Conversations fetched successfully',
            ...result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ===================== PRIORITY ASSIGNMENT =====================

export const assignContactsByPriority = async (req, res, next) => {
    try {
        const { contactIds } = req.body;
        const tenantId = req.tenant.id;

        const result = await assignByPriority(contactIds, tenantId);

        return res.status(200).json({
            success: true,
            message: `Processed ${contactIds.length} contacts. ${result.success} assigned, ${result.failed} failed.`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};


// ===================== AUTO-REOPEN =====================

export const getAutoReopenConfig = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const config = await getAutoReopenConfigService(tenantId);
        return res.status(200).json({
            success: true,
            data: config
        });
    } catch (error) {
        next(error);
    }
};


export const updateAutoReopenConfig = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const config = await updateAutoReopenConfigService(tenantId, req.body);
        return res.status(200).json({
            success: true,
            message: 'Auto-reopen configuration updated successfully',
            data: config,
        });
    } catch (error) {
        next(error);
    }
};


// ===================== WHATSAPP CREDENTIALS =====================

export const getWhatsappCredentials = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                whatsappPhoneId: true,
                whatsappWabaId: true,
                whatsappVerifyToken: true,
                whatsappAccessToken: true,
            },
        });
        return res.status(200).json({
            success: true,
            data: tenant
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


export const updateWhatsappCredentials = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const { phoneId, wabaId, accessToken, verifyToken } = req.body;

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                whatsappPhoneId: phoneId,
                whatsappWabaId: wabaId,
                whatsappAccessToken: accessToken,
                whatsappVerifyToken: verifyToken,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'WhatsApp credentials updated successfully',
            data: updated,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
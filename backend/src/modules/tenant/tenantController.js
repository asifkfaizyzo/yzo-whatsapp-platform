// modules/tenant/tenantController.js

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../auth/jwtservice.js';
import { loginUserService } from '../users/userService.js';
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
    updateAutoReopenConfigService,
    loginOrRegisterWithGoogleService,
    updateTenantPasswordService,
    forgotPasswordTenantService,
    resetPasswordTenantService,
    uploadTenantLogoService,
    deleteTenantLogoService
} from './tenantService.js';
import {
    userGetUnassignedContacts,
    userAssignMultipleContacts,
    assignByPriority
} from '../contacts/userContactService.js';
import { updateTenantByIdService } from '../superadmin/superadminService.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { sendVerificationOtpEmail } from '../auth/emailService.js';
import { extractRequestMeta } from '../../lib/utils/requestMeta.js';


// ===================== TENANT AUTH =====================
export const registerTenant = async (req, res) => {
    try {
        const result = await registerTenantService(req.body);
        const { accessToken, refreshToken, user } = result.data;

        res.cookie('tenant_refreshToken', refreshToken, {
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
        const meta = extractRequestMeta(req);

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
        let cookieName = 'tenant_refreshToken';

        if (tenantExists) {
            result = await loginTenantService(req.body, meta);
            cookieName = 'tenant_refreshToken';
        } else {
            const userExists = await prisma.user.findUnique({ where: { email } });
            if (userExists) {
                result = await loginUserService(req.body, meta);
                cookieName = 'user_refreshToken';
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credentials',
                });
            }
        }
        const { accessToken, refreshToken, user } = result;

        res.cookie(cookieName, refreshToken, {
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
        const refreshToken = req.cookies.tenant_refreshToken || req.cookies.user_refreshToken || req.cookies.refreshToken || req.body.refreshToken;

        if (refreshToken) {
            await logoutTenantService(refreshToken);
        }

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
        };

        res.clearCookie('tenant_refreshToken', cookieOptions);
        res.clearCookie('user_refreshToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);
        res.clearCookie('onboarding_token', cookieOptions);

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
        const refreshToken = req.cookies.tenant_refreshToken || req.cookies.refreshToken || req.body.refreshToken;

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
            user: result.user,
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
                address: true,
                onboardingStep: true,
                onboardingCompleted: true,
                firstName: true,
                lastName: true,
                authProvider: true,
                password: true,
                websiteUrl: true,
                industry: true,
                companySize: true,
                country: true,
                useCase: true,
                logo: true,
                timezone: true,
            },
        });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const { password, ...safeTenant } = tenant;
        const tenantData = {
            ...safeTenant,
            hasPassword: !!password
        };

        return res.status(200).json({
            success: true,
            data: tenantData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ═══════════════════════════════════════════
// UPDATE TENANT PROFILE — tenant updates themselves
// ═══════════════════════════════════════════
export const updateTenantProfile = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const meta     = extractRequestMeta(req);

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant not authenticated',
      });
    }

    const {
      tenantName,
      email,
      phone,
      address,
      websiteUrl,
      industry,
      companySize,
      country,
    } = req.body;

    const result = await updateTenantByIdService(
      tenantId,
      { tenantName, email, phone, address, websiteUrl, industry, companySize, country },
      null,
      meta
    );

    return res.status(200).json({
      success: true,
      message: 'Tenant profile updated successfully',
      data:    result.tenant,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// Complete Onboarding — Step 2 of registration (authenticated, updates company info)
export const completeOnboarding = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const { tenantName, websiteUrl, industry, companySize, country, phone, address } = req.body;

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                tenantName: tenantName || undefined,
                websiteUrl: websiteUrl || undefined,
                industry:   industry   || undefined,
                companySize: companySize || undefined,
                country:    country    || undefined,
                phone:      phone      || undefined,
                address:    address    || undefined,
                onboardingStep: 6,
                onboardingCompleted: true,
            },
        });

        const { password: _, ...safeTenant } = updatedTenant;

        return res.status(200).json({
            success: true,
            message: 'Onboarding completed successfully',
            data: {
                user: {
                    id: safeTenant.id,
                    name: safeTenant.tenantName,
                    email: safeTenant.email,
                    type: 'TENANT',
                    status: safeTenant.status,
                    planId: safeTenant.planId,
                    planStatus: safeTenant.planStatus,
                    billingType: safeTenant.billingType,
                    tenantName: safeTenant.tenantName,
                    firstName: safeTenant.firstName,
                    lastName: safeTenant.lastName,
                    onboardingStep: safeTenant.onboardingStep,
                    onboardingCompleted: safeTenant.onboardingCompleted,
                },
            },
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
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

export const updateTenantPassword = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant not authenticated'
            });
        }
        
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const result = await updateTenantPasswordService(tenantId, {
            currentPassword,
            newPassword,
            confirmPassword
        });

        return res.status(200).json({
            success: true,
            message: result.message
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

// ======== Fetch Tenant WhatsApp Config ========
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

        if (tenant && tenant.whatsappAccessToken) {
            tenant.whatsappAccessToken = decrypt(tenant.whatsappAccessToken);
        }

        return res.status(200).json({
            success: true,
            data: tenant,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ======== Update Tenant WhatsApp Config ========
export const updateWhatsappCredentials = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const { phoneId, wabaId, accessToken, verifyToken } = req.body;

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                whatsappPhoneId: phoneId,
                whatsappWabaId: wabaId,
                whatsappAccessToken: accessToken ? encrypt(accessToken) : undefined,
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
            message: error.message,
        });
    }
};

// =========== Google Login Controller Handler ===========
export const googleLoginTenant = async (req, res) => {
    try {
        const { credential } = req.body;
        const result = await loginOrRegisterWithGoogleService(credential);
        const { accessToken, refreshToken, user } = result;

        res.cookie('tenant_refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        return res.status(200).json({
            success: true,
            message: 'Google login successful',
            data: { user, accessToken },
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || 'Google Auth failed',
        });
    }
};

// ===================== MULTI-STEP ONBOARDING CONTROLLERS =====================

// Step 1: First name + Last name. Creates user record and returns onboarding token in HttpOnly cookie.
export const onboardingStep1 = async (req, res) => {
    try {
        const { firstName, lastName } = req.body;

        const tenant = await prisma.tenant.create({
            data: {
                firstName,
                lastName,
                onboardingStep: 2,
                onboardingCompleted: false,
                status: 'PENDING'
            }
        });

        const onboardingToken = jwt.sign(
            { id: tenant.id, type: 'TENANT_ONBOARDING' },
            process.env.ACCESS_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('onboarding_token', onboardingToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        return res.status(201).json({
            success: true,
            message: 'Step 1 complete: Tenant created',
            data: {
                user: {
                    id: tenant.id,
                    firstName: tenant.firstName,
                    lastName: tenant.lastName,
                    onboardingStep: tenant.onboardingStep,
                    onboardingCompleted: tenant.onboardingCompleted,
                    type: 'TENANT'
                }
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Step 2: Email. Updates email and sends verification OTP.
export const onboardingStep2 = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { email } = req.body;

        const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] = await Promise.all([
            prisma.tenant.findUnique({ where: { email } }),
            prisma.user.findUnique({ where: { email } }),
            prisma.superAdmin.findUnique({ where: { email } }),
        ]);

        if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered on the platform'
            });
        }

        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                email,
                otpHash,
                otpExpiresAt,
                isEmailVerified: false
            }
        });

        await sendVerificationOtpEmail(email, otpCode);

        return res.status(200).json({
            success: true,
            message: 'Step 2 complete: Verification email sent successfully.',
            data: {
                user: {
                    id: updated.id,
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    email: updated.email,
                    onboardingStep: updated.onboardingStep,
                    onboardingCompleted: updated.onboardingCompleted,
                    type: 'TENANT'
                }
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Verify OTP Code and advance onboardingStep to 3
export const verifyEmailOtp = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { otpCode } = req.body;

        if (!otpCode || otpCode.length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'A valid 6-digit verification code is required.'
            });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant || !tenant.otpHash || !tenant.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: 'Verification request not found. Please request a new code.'
            });
        }

        if (new Date() > tenant.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new one.'
            });
        }

        const hashedInput = crypto.createHash('sha256').update(otpCode).digest('hex');
        if (hashedInput !== tenant.otpHash) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect verification code.'
            });
        }

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                isEmailVerified: true,
                onboardingStep: 3,
                otpHash: null,
                otpExpiresAt: null
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            data: {
                user: {
                    id: updated.id,
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    email: updated.email,
                    onboardingStep: updated.onboardingStep,
                    onboardingCompleted: updated.onboardingCompleted,
                    type: 'TENANT'
                }
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Step 3: Password. Hashes and updates password.
export const onboardingStep3 = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                password: hashedPassword,
                onboardingStep: 4
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Step 3 complete: Password updated',
            data: {
                user: {
                    id: updated.id,
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    email: updated.email,
                    onboardingStep: updated.onboardingStep,
                    onboardingCompleted: updated.onboardingCompleted,
                    type: 'TENANT'
                }
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Step 4: Company name + Website
export const onboardingStep4 = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { tenantName, websiteUrl } = req.body;

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                tenantName,
                websiteUrl,
                onboardingStep: 5
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Step 4 complete: Company info updated',
            data: {
                user: {
                    id: updated.id,
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    email: updated.email,
                    tenantName: updated.tenantName,
                    websiteUrl: updated.websiteUrl,
                    onboardingStep: updated.onboardingStep,
                    onboardingCompleted: updated.onboardingCompleted,
                    type: 'TENANT'
                }
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Step 5: Business phone + Team size + Use case. Completes onboarding and issues full login session cookies.
export const onboardingStep5 = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { phone, companySize, useCase } = req.body;

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                phone,
                companySize,
                useCase,
                onboardingStep: 6,
                onboardingCompleted: true
            }
        });

        const accessToken = generateAccessToken({
            id: updated.id,
            email: updated.email,
            type: 'TENANT',
        });

        const refreshToken = generateRefreshToken({
            id: updated.id,
            type: 'TENANT',
        });

        const { saveRefreshToken } = await import('../auth/refreshtokenService.js');
        await saveRefreshToken({
            token: refreshToken,
            tenantId: updated.id,
        });

        res.clearCookie('onboarding_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/'
        });

        res.cookie('tenant_refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        return res.status(200).json({
            success: true,
            message: 'Onboarding completed and logged in successfully',
            data: {
                accessToken,
                user: {
                    id: updated.id,
                    name: updated.tenantName,
                    email: updated.email,
                    type: 'TENANT',
                    status: updated.status,
                    planId: updated.planId,
                    planStatus: updated.planStatus,
                    billingType: updated.billingType,
                    tenantName: updated.tenantName,
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    phone: updated.phone,
                    address: updated.address,
                    onboardingStep: updated.onboardingStep,
                    onboardingCompleted: updated.onboardingCompleted
                }
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get current onboarding status using cookie token
export const getOnboardingStatus = async (req, res) => {
    try {
        const token = req.cookies.onboarding_token;
        if (!token) {
            return res.status(200).json({
                success: true,
                data: null
            });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
        const tenant = await prisma.tenant.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                tenantName: true,
                websiteUrl: true,
                phone: true,
                companySize: true,
                useCase: true,
                onboardingStep: true,
                onboardingCompleted: true
            }
        });

        if (!tenant) {
            res.clearCookie('onboarding_token', { path: '/' });
            return res.status(200).json({ success: true, data: null });
        }

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    ...tenant,
                    type: 'TENANT'
                }
            }
        });
    } catch (error) {
        res.clearCookie('onboarding_token', { path: '/' });
        return res.status(200).json({
            success: true,
            data: null
        });
    }
};


// =========== Upload Tenant Logo ===========
export const uploadTenantLogo = async (req, res) => {
  try {
    const result = await uploadTenantLogoService(req.tenantId, req.file);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// =========== Delete Tenant Logo ===========
export const deleteTenantLogo = async (req, res) => {
  try {
    const result = await deleteTenantLogoService(req.tenantId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
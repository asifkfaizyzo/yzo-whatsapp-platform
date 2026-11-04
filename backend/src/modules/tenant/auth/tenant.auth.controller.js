// backend/src/modules/tenant/auth/tenant.auth.controller.js (do not remove this comment)
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../../config/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../../auth/jwt.service.js';
import { loginUserService } from '../../users/user.service.js';
import {
    registerTenantService,
    loginTenantService,
    logoutTenantService,
    refreshTenantAccessTokenService,
    loginOrRegisterWithGoogleService,
    loginOrRegisterWithFacebookService,
    forgotPasswordTenantService,
    resetPasswordTenantService,
} from './tenant.auth.service.js';
import { sendVerificationOtpEmail, sendTenantWelcomeEmail } from '../../auth/email.service.js';
import { extractRequestMeta } from '../../../lib/utils/request.meta.js';
import { createSuperAdminNotification } from '../../superadmin-notifications/superadminNotification.service.js';
import { emitToSuperAdmin } from '../../../lib/socket.js';

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
            data: { user, accessToken, refreshToken },
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
            data: { user, accessToken, refreshToken }
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
            data: { user, accessToken, refreshToken },
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || 'Google Auth failed',
        });
    }
};

export const facebookLoginTenant = async (req, res) => {
    try {
        const { accessToken: facebookAccessToken } = req.body;
        const result = await loginOrRegisterWithFacebookService(facebookAccessToken);
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
            message: 'Facebook login successful',
            data: { user, accessToken, refreshToken },
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || 'Facebook Auth failed',
        });
    }
};

// ===================== MULTI-STEP ONBOARDING =====================

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

export const onboardingStep2 = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { email } = req.body;

        const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] = await Promise.all([
            prisma.tenant.findUnique({ where: { email } }),
            prisma.user.findUnique({ where: { email } }),
            prisma.superAdmin.findUnique({ where: { email } }),
        ]);

        if ((emailExistsInTenant && emailExistsInTenant.id !== tenantId) || emailExistsInUser || emailExistsInSuperAdmin) {
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
            data: { email }
        });

        await prisma.tenantAuth.upsert({
            where: { tenantId },
            create: {
                tenantId,
                otpHash,
                otpExpiresAt,
                isEmailVerified: false,
            },
            update: {
                otpHash,
                otpExpiresAt,
                isEmailVerified: false,
            },
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
            where: { id: tenantId },
            include: { auth: true }
        });

        if (!tenant || !tenant.auth?.otpHash || !tenant.auth?.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: 'Verification request not found. Please request a new code.'
            });
        }

        if (new Date() > tenant.auth.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new one.'
            });
        }

        const hashedInput = crypto.createHash('sha256').update(otpCode).digest('hex');
        if (hashedInput !== tenant.auth.otpHash) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect verification code.'
            });
        }

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: { onboardingStep: 3 }
        });

        await prisma.tenantAuth.update({
            where: { tenantId },
            data: {
                isEmailVerified: true,
                otpHash: null,
                otpExpiresAt: null,
            },
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

        await sendTenantWelcomeEmail({
            email:      updated.email,
            firstName:  updated.firstName,
            lastName:   updated.lastName,
            tenantName: updated.tenantName,
        });

        try {
            const notification = await createSuperAdminNotification({
                type:    'tenant_registered',
                title:   '🆕 New Tenant Registered',
                message: `${updated.tenantName || `${updated.firstName} ${updated.lastName}`} just completed onboarding and joined the platform.`,
                metadata: {
                    tenantId:   updated.id,
                    tenantName: updated.tenantName,
                    email:      updated.email,
                    firstName:  updated.firstName,
                    lastName:   updated.lastName,
                    registeredAt: new Date().toISOString(),
                },
            });

            emitToSuperAdmin('superadmin_notification', { notification });

            console.log(`✅ SuperAdmin notified — new tenant: ${updated.email}`);
        } catch (err) {
            console.error('❌ SuperAdmin notification failed:', err.message);
        }

        const accessToken = generateAccessToken({
            id: updated.id,
            email: updated.email,
            type: 'TENANT',
        });

        const refreshToken = generateRefreshToken({
            id: updated.id,
            type: 'TENANT',
        });

        const { saveRefreshToken } = await import('../../auth/refreshToken.service.js');
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
                refreshToken,
                user: {
                    id: updated.id,
                    name: updated.tenantName,
                    email: updated.email,
                    type: 'TENANT',
                    status: updated.status,
                    planId: null,
                    planStatus: null,
                    billingType: null,
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

import path from 'path';
import fs from 'fs';
import prisma from '../../config/prisma.js';
import { extractRequestMeta } from '../../lib/utils/requestMeta.js';
import {
  createSuperAdminService,
  loginSuperAdminService,
  logoutSuperAdminService,
  refreshAccessTokenService,
  getAllTenantsService,
  getTenantByIdService,
  updateTenantByIdService,
  deactivateTenantService,
  reactivateTenantService,
  deleteTenantByIdService,
  approveTenantService,
  blockTenantService,
  unblockTenantService,
  forgotPasswordSuperAdminService,
  resetPasswordSuperAdminService,
  deactivateUserService,
  reactivateUserService,
  getRevenueStatsService,
  getAllPaymentsService,
  getTenantBillingService,
} from './superadminService.js';


// ═══════════════════════════════════════════
// CREATE SUPERADMIN — no audit needed
// ═══════════════════════════════════════════
export const createSuperAdmin = async (req, res) => {
  try {
    const result = await createSuperAdminService(req.body);
    return res.status(201).json({
      success: true,
      message: 'SuperAdmin created successfully',
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ═══════════════════════════════════════════
// LOGIN — pass meta for audit
// ═══════════════════════════════════════════
export const loginSuperAdmin = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const result = await loginSuperAdminService(req.body, meta);

    const { accessToken, refreshToken, user } = result;

    res.cookie('admin_refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'SuperAdmin logged in successfully',
      data: { user, accessToken },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ═══════════════════════════════════════════
// LOGOUT — pass meta for audit
// ═══════════════════════════════════════════
export const logoutSuperAdmin = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const refreshToken = req.cookies.admin_refreshToken || req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await logoutSuperAdminService(refreshToken, meta);
    }

    res.clearCookie('admin_refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ═══════════════════════════════════════════
// REFRESH TOKEN — no audit needed
// ═══════════════════════════════════════════
export const refreshAccessTokenController = async (req, res) => {
  try {
    const refreshToken = req.cookies.admin_refreshToken || req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found in cookies or body',
      });
    }

    const result = await refreshAccessTokenService(refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      accessToken: result.accessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};


// ═══════════════════════════════════════════
// FORGOT PASSWORD — no audit needed
// ═══════════════════════════════════════════
export const forgotPasswordSuperAdmin = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPasswordSuperAdminService(email);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// RESET PASSWORD — no audit needed
// ═══════════════════════════════════════════
export const resetPasswordSuperAdmin = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const result = await resetPasswordSuperAdminService(
      token,
      newPassword,
      confirmPassword
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// GET ALL TENANTS — no audit needed (just reading)
// ═══════════════════════════════════════════
export const getAllTenants = async (req, res) => {
  try {
    const result = await getAllTenantsService();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// GET TENANT BY ID — no audit needed (just reading)
// ═══════════════════════════════════════════
export const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getTenantByIdService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// UPDATE TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const updateTenantById = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const data = req.body;
    const result = await updateTenantByIdService(id, data, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// DEACTIVATE TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const deactivateTenant = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await deactivateTenantService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// REACTIVATE TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const reactivateTenant = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await reactivateTenantService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// DELETE TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const deleteTenantById = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await deleteTenantByIdService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// APPROVE TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const approveTenant = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await approveTenantService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// BLOCK TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const blockTenant = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await blockTenantService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// UNBLOCK TENANT — pass actor + meta
// ═══════════════════════════════════════════
export const unblockTenant = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await unblockTenantService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// DEACTIVATE USER — pass actor + meta
// ═══════════════════════════════════════════
export const deactivateUser = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await deactivateUserService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// REACTIVATE USER — pass actor + meta
// ═══════════════════════════════════════════
export const reactivateUser = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const actor = req.superAdmin;
    const { id } = req.params;
    const result = await reactivateUserService(id, actor, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// REVENUE — no audit needed (just reading)
// ═══════════════════════════════════════════
export const getRevenueStats = async (req, res) => {
  try {
    const result = await getRevenueStatsService();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const result = await getAllPaymentsService();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenantBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getTenantBillingService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ═══════════════════════════════════════════
// DOWNLOAD INVOICE — no audit needed
// ═══════════════════════════════════════════
export const adminDownloadInvoice = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { tenant: true },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    let filePath;
    let fileName;

    // Generate invoice if not exists
    if (!payment.invoiceUrl) {
      const { generateInvoicePDF } = await import('../plans/invoiceService.js');

      const generated = await generateInvoicePDF(payment, payment.tenant);
      filePath = generated.filePath;
      fileName = `${generated.invoiceNumber}.pdf`;

      await prisma.payment.update({
        where: { id: paymentId },
        data: { invoiceUrl: generated.fileUrl },
      });
    } else {
      filePath = path.join(process.cwd(), payment.invoiceUrl);
      fileName = path.basename(payment.invoiceUrl);

      if (!fs.existsSync(filePath)) {
        const { generateInvoicePDF } = await import('../plans/invoiceService.js');
        const generated = await generateInvoicePDF(payment, payment.tenant);
        filePath = generated.filePath;
        fileName = `${generated.invoiceNumber}.pdf`;
      }
    }

    return res.download(filePath, fileName);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
};
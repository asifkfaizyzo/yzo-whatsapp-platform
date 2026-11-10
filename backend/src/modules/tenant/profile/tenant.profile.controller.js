// backend/src/modules/tenant/profile/tenant.profile.controller.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { updateTenantByIdService } from "./tenant.profile.service.js";
import {
  updateTenantPasswordService,
  uploadTenantLogoService,
  deleteTenantLogoService,
} from "./tenant.profile.service.js";
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";

export const getLoggedInTenant = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant not authenticated",
      });
    }

    const tenantRow = await prisma.tenant.findUnique({
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
        password: true,
        websiteUrl: true,
        industry: true,
        companySize: true,
        country: true,
        useCase: true,
        logo: true,
        timezone: true,
        auth: {
          select: { authProvider: true },
        },
        subscription: {
          select: {
            planId: true,
            currentPlan: true,
            planStatus: true,
            subscriptionStatus: true,
            planPeriodStart: true,
            planPeriodEnd: true,
            hasUsedTrial: true,
            autopayEnabled: true,
            cancelRequestedAt: true,
            billingType: true,
          },
        },
      },
    });
    const tenant = tenantRow
      ? { ...tenantRow, ...tenantRow.auth, ...tenantRow.subscription }
      : null;

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const { password, ...safeTenant } = tenant;
    const tenantData = {
      ...safeTenant,
      hasPassword: !!password,
    };

    return res.status(200).json({
      success: true,
      data: tenantData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateTenantProfile = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const meta = extractRequestMeta(req);

    console.log("?? Update profile - tenantId:", tenantId);
    console.log("?? Update profile - body:", req.body);

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant not authenticated",
      });
    }

    const {
      tenantName,
      firstName,
      lastName,
      email,
      phone,
      address,
      websiteUrl,
      industry,
      companySize,
      country,
      timezone,
      logo,
    } = req.body;

    const result = await updateTenantByIdService(
      tenantId,
      {
        tenantName,
        firstName,
        lastName,
        email,
        phone,
        address,
        websiteUrl,
        industry,
        companySize,
        country,
        timezone,
        logo,
      },
      null,
      meta,
    );

    return res.status(200).json({
      success: true,
      message: "Tenant profile updated successfully",
      data: result.tenant,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const completeOnboarding = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const {
      tenantName,
      websiteUrl,
      industry,
      companySize,
      country,
      phone,
      address,
    } = req.body;

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        tenantName: tenantName || undefined,
        websiteUrl: websiteUrl || undefined,
        industry: industry || undefined,
        companySize: companySize || undefined,
        country: country || undefined,
        phone: phone || undefined,
        address: address || undefined,
        onboardingStep: 6,
        onboardingCompleted: true,
      },
      include: { subscription: true },
    });
    Object.assign(updatedTenant, updatedTenant?.subscription);

    const { password: _, ...safeTenant } = updatedTenant;

    return res.status(200).json({
      success: true,
      message: "Onboarding completed successfully",
      data: {
        user: {
          id: safeTenant.id,
          name: safeTenant.tenantName,
          email: safeTenant.email,
          type: "TENANT",
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

export const updateTenantPassword = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant not authenticated",
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const result = await updateTenantPasswordService(tenantId, {
      currentPassword,
      newPassword,
      confirmPassword,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadTenantLogo = async (req, res) => {
  try {
    const result = await uploadTenantLogoService(req.tenantId, req.file);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteTenantLogo = async (req, res) => {
  try {
    const result = await deleteTenantLogoService(req.tenantId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

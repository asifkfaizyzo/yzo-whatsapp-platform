// backend/src/modules/tenant/profile/tenant.profile.service.js (do not remove this comment)
import bcrypt from "bcrypt";
import prisma from "../../../config/prisma.js";
import fs from "fs";
import { createAuditLog } from "../../audit/audit.service.js";

export const updateTenantPasswordService = async (
  tenantId,
  { currentPassword, newPassword, confirmPassword },
) => {
  if (!newPassword || !confirmPassword) {
    throw new Error("New password and confirm password are required");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (tenant.password) {
    if (!currentPassword) {
      throw new Error("Current password is required to change password");
    }
    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      tenant.password,
    );
    if (!isPasswordMatch) {
      throw new Error("Incorrect current password");
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { password: hashedPassword },
  });

  console.log("?????????????????????????????????????");
  console.log("?? STEP 1 - Reached audit log section");
  console.log("?? tenant.id      :", tenant.id);
  console.log("?? tenant.email   :", tenant.email);
  console.log("?? tenant.tenantName:", tenant.tenantName);
  console.log("?????????????????????????????????????");

  try {
    const auditPayload = {
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "PASSWORD_CHANGED",
      module: "AUTH",
      description: `Tenant "${tenant.tenantName}" changed their password`,
      tenantId: tenant.id,
    };

    console.log(
      "?? STEP 2 - Audit payload:",
      JSON.stringify(auditPayload, null, 2),
    );

    const auditResult = await createAuditLog(auditPayload);

    console.log(
      "? STEP 3 - Audit log created:",
      auditResult?.id ?? auditResult,
    );
  } catch (auditError) {
    console.error("? STEP 3 - Audit log FAILED");
    console.error("? Error message :", auditError.message);
    console.error("? Error code    :", auditError.code);
    console.error("? Full error    :", auditError);
  }

  return { message: "Password updated successfully" };
};

export const uploadTenantLogoService = async (tenantId, file) => {
  if (!tenantId) throw new Error("Tenant ID is required");
  if (!file) throw new Error("No file uploaded");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.logo) {
    try {
      const oldLogoPath = tenant.logo.replace(/^\/+/, "");
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    } catch (err) {
      console.error("Failed to delete old logo:", err.message);
    }
  }

  const logoUrl = `/${file.path.replace(/\\/g, "/")}`;

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { logo: logoUrl },
    select: { id: true, tenantName: true, logo: true },
  });

  return {
    message: "Logo uploaded successfully",
    data: { logoUrl: updatedTenant.logo, tenant: updatedTenant },
  };
};

export const deleteTenantLogoService = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new Error("Tenant not found");
  if (!tenant.logo) throw new Error("No logo to delete");

  try {
    const logoPath = tenant.logo.replace(/^\/+/, "");
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
  } catch (err) {
    console.error("Failed to delete logo file:", err.message);
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logo: null },
  });

  return { message: "Logo removed successfully" };
};

// ═══════════════════════════════════════════
// UPDATE TENANT PROFILE (moved from superadmin.service.js)
// Used by both tenant self-update (actor=null) and SRAdmin update
// ═══════════════════════════════════════════
export const updateTenantByIdService = async (
  tenantId,
  data,
  actor = null,
  meta = {},
) => {
  if (!tenantId) throw new Error("Tenant ID is required");

  const existingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!existingTenant) throw new Error("Tenant not found");

  const updateData = {};

  if (data.tenantName) updateData.tenantName = data.tenantName;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
  if (data.industry !== undefined) updateData.industry = data.industry;
  if (data.companySize !== undefined) updateData.companySize = data.companySize;
  if (data.country !== undefined) updateData.country = data.country;
  if (data.useCase !== undefined) updateData.useCase = data.useCase;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.logo !== undefined) updateData.logo = data.logo;

  if (data.email) {
    const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] =
      await Promise.all([
        prisma.tenant.findFirst({
          where: { email: data.email, id: { not: tenantId } },
        }),
        prisma.user.findUnique({ where: { email: data.email } }),
        prisma.superAdmin.findUnique({ where: { email: data.email } }),
      ]);
    if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
      throw new Error("Email already in use");
    }
    updateData.email = data.email;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("No valid fields to update");
  }

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      id: true,
      tenantName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      websiteUrl: true,
      industry: true,
      companySize: true,
      country: true,
      useCase: true,
      timezone: true,
      logo: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const changedFields = Object.keys(updateData).reduce((acc, key) => {
    acc[key] = {
      from: existingTenant[key] ?? null,
      to: updateData[key],
    };
    return acc;
  }, {});

  if (actor) {
    await createAuditLog({
      actorId: actor.id,
      actorType: "SUPER_ADMIN",
      actorName: actor.name,
      actorEmail: actor.email,
      action: "TENANT_UPDATED",
      module: "TENANT",
      description: `SuperAdmin "${actor.name}" updated tenant "${existingTenant.tenantName}"`,
      targetId: existingTenant.id,
      targetType: "TENANT",
      targetName: existingTenant.tenantName,
      tenantId: existingTenant.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { changedFields },
    });
  } else {
    await createAuditLog({
      actorId: existingTenant.id,
      actorType: "TENANT",
      actorName: existingTenant.tenantName || existingTenant.email,
      actorEmail: existingTenant.email,
      action: "TENANT_UPDATED",
      module: "TENANT",
      description: `Tenant "${existingTenant.tenantName}" updated their own profile`,
      targetId: existingTenant.id,
      targetType: "TENANT",
      targetName: existingTenant.tenantName,
      tenantId: existingTenant.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { changedFields },
    });
  }

  return { message: "Tenant updated successfully", tenant: updatedTenant };
};
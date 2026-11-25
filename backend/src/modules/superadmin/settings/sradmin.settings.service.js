// backend/src/modules/superadmin/settings/sradmin.settings.service.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { createAuditLog } from "../../audit/audit.service.js";

// -- Get GST Settings --
export const getGSTSettingsService = async () => {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: "GLOBAL" },
  });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: {
        id: "GLOBAL",
        gstEnabled: true,
        gstPercent: 18.0,
        gstType: "CGST_SGST",
        companyGstNumber: "27AABCU9603R1ZM",
        pricingType: "EXCLUSIVE",
        companyName: "SudoReply Technologies Pvt Ltd",
        companyEmail: "info@sudoreply.com",
        companyAddress: "Mumbai, Maharashtra, India",
        sacCode: "998314",
      },
    });
  }

  return settings;
};

// -- Update GST Settings --
export const updateGSTSettingsService = async (data, actor, meta = {}) => {
  const {
    gstEnabled,
    gstPercent,
    gstType,
    companyGstNumber,
    pricingType,
    companyName,
    companyEmail,
    companyAddress,
    sacCode,
  } = data;

  if (gstPercent !== undefined) {
    const pct = parseFloat(gstPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      throw new Error("GST percent must be between 0 and 100");
    }
  }

  if (gstType && !["CGST_SGST", "IGST"].includes(gstType)) {
    throw new Error("GST type must be CGST_SGST or IGST");
  }

  if (pricingType && !["EXCLUSIVE", "INCLUSIVE"].includes(pricingType)) {
    throw new Error("Pricing type must be EXCLUSIVE or INCLUSIVE");
  }

  const updateData = {};
  if (gstEnabled !== undefined) updateData.gstEnabled = Boolean(gstEnabled);
  if (gstPercent !== undefined) updateData.gstPercent = parseFloat(gstPercent);
  if (gstType !== undefined) updateData.gstType = gstType;
  if (companyGstNumber !== undefined) updateData.companyGstNumber = companyGstNumber;
  if (pricingType !== undefined) updateData.pricingType = pricingType;
  if (companyName !== undefined) updateData.companyName = companyName;
  if (companyEmail !== undefined) updateData.companyEmail = companyEmail;
  if (companyAddress !== undefined) updateData.companyAddress = companyAddress;
  if (sacCode !== undefined) updateData.sacCode = sacCode;
  if (actor?.id) updateData.updatedBy = actor.id;

  const updated = await prisma.platformSettings.upsert({
    where: { id: "GLOBAL" },
    update: updateData,
    create: {
      id: "GLOBAL",
      gstEnabled: gstEnabled !== undefined ? Boolean(gstEnabled) : true,
      gstPercent: gstPercent !== undefined ? parseFloat(gstPercent) : 18.0,
      gstType: gstType || "CGST_SGST",
      companyGstNumber: companyGstNumber || "27AABCU9603R1ZM",
      pricingType: pricingType || "EXCLUSIVE",
      companyName: companyName || "SudoReply Technologies Pvt Ltd",
      companyEmail: companyEmail || "info@sudoreply.com",
      companyAddress: companyAddress || "Mumbai, Maharashtra, India",
      sacCode: sacCode || "998314",
      updatedBy: actor?.id || null,
    },
  });

  if (actor?.id) {
    await createAuditLog({
      actorId: actor.id,
      actorType: "SUPER_ADMIN",
      actorName: actor.name,
      actorEmail: actor.email,
      action: "GST_SETTINGS_UPDATED",
      module: "SETTINGS",
      description: `SuperAdmin "${actor.name}" updated GST settings — GST is now ${updated.gstEnabled ? "ENABLED" : "DISABLED"} at ${updated.gstPercent}%`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: null,
      metadata: {
        gstEnabled: updated.gstEnabled,
        gstPercent: updated.gstPercent,
        gstType: updated.gstType,
        pricingType: updated.pricingType,
      },
    });
  }

  return updated;
};
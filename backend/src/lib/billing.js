// backend/src/lib/billing.js (do not remove this comment)
import prisma from "../config/prisma.js";

// -- Get GST Config Helper (used by calculateGST and other services) --
export const getGSTConfig = async () => {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "GLOBAL" },
    });

    if (!settings) {
      return {
        gstEnabled: false,
        gstPercent: 0,
        gstType: "CGST_SGST",
        pricingType: "EXCLUSIVE",
        companyGstNumber: "",
        companyName: "SudoReply Technologies Pvt Ltd",
        companyEmail: "info@sudoreply.com",
        companyAddress: "Mumbai, Maharashtra, India",
        sacCode: "998314",
      };
    }

    return {
      gstEnabled: Boolean(settings.gstEnabled),
      gstPercent: settings.gstPercent || 0,
      gstType: settings.gstType || "CGST_SGST",
      pricingType: settings.pricingType || "EXCLUSIVE",
      companyGstNumber: settings.companyGstNumber || "",
      companyName: settings.companyName,
      companyEmail: settings.companyEmail,
      companyAddress: settings.companyAddress,
      sacCode: settings.sacCode,
    };
  } catch {
    return {
      gstEnabled: false,
      gstPercent: 0,
      gstType: "CGST_SGST",
      pricingType: "EXCLUSIVE",
    };
  }
};

// -- Calculate GST for a base amount --
export const calculateGST = async (baseAmount) => {
  const config = await getGSTConfig();
  const base = parseFloat(baseAmount);

  if (!config.gstEnabled) {
    return {
      gstEnabled: false,
      baseAmount: base,
      gstPercent: 0,
      gstAmount: 0,
      totalAmount: base,
      gstType: config.gstType,
    };
  }

  const gstAmount = parseFloat(((base * config.gstPercent) / 100).toFixed(2));
  const totalAmount = parseFloat((base + gstAmount).toFixed(2));

  return {
    gstEnabled: true,
    baseAmount: base,
    gstPercent: config.gstPercent,
    gstAmount,
    totalAmount,
    gstType: config.gstType,
  };
};
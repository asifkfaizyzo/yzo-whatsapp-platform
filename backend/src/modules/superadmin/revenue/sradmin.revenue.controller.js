// backend/src/modules/superadmin/revenue/sradmin.revenue.controller.js
import path from "path";
import fs from "fs";
import prisma from "../../../config/prisma.js";

import {
  getPlatformRevenueStatsService,
  getRevenueStatsService,
  getRevenuePaymentsService,
  getTenantBillingDetailService,
  getInvoiceUrlService,
} from "./sradmin.revenue.service.js";

// -- Dashboard Card — GET /sradmin/revenue-stats --
export const getPlatformRevenueStats = async (req, res) => {
  try {
    const data = await getPlatformRevenueStatsService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revenue stats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// -- Revenue Page Stats — GET /sradmin/revenue/stats --
export const getRevenueStats = async (req, res) => {
  try {
    const data = await getRevenueStatsService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revenue stats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// -- Revenue Payments — GET /sradmin/revenue/payments --
export const getRevenuePayments = async (req, res) => {
  try {
    const data = await getRevenuePaymentsService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revenue payments error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// -- Tenant Billing Detail — GET /sradmin/revenue/tenant/:tenantId --
export const getTenantBillingDetail = async (req, res) => {
  try {
    const data = await getTenantBillingDetailService(req.params.tenantId);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Tenant billing detail error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// -- Invoice URL (exported but not routed — see adminDownloadInvoice) --
export const getInvoiceUrl = async (req, res) => {
  try {
    const invoiceUrl = await getInvoiceUrlService(req.params.paymentId);
    if (!invoiceUrl) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: { invoiceUrl },
    });
  } catch (error) {
    console.error("Invoice URL error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// -- Admin Invoice Download — GET /sradmin/revenue/invoice/:paymentId --
export const adminDownloadInvoice = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { tenant: true },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    let filePath;
    let fileName;

    if (!payment.invoiceUrl) {
      const { generateInvoicePDF } = await import("../../plans/invoice.service.js");
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
        const { generateInvoicePDF } = await import("../../plans/invoice.service.js");
        const generated = await generateInvoicePDF(payment, payment.tenant);
        filePath = generated.filePath;
        fileName = `${generated.invoiceNumber}.pdf`;
      }
    }

    return res.download(filePath, fileName);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
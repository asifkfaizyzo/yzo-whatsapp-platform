// backend/src/modules/revenue/revenueController.js

import {
  getPlatformRevenueStatsService,
  getRevenueStatsService,
  getRevenuePaymentsService,
  getTenantBillingDetailService,
  getInvoiceUrlService,
} from "./revenueService.js";

// ── Dashboard Card → GET /api/revenue-stats ──
export const getPlatformRevenueStats = async (req, res) => {
  try {
    const data = await getPlatformRevenueStatsService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revenue stats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Revenue Page Stats → GET /api/revenue/stats ──
export const getRevenueStats = async (req, res) => {
  try {
    const data = await getRevenueStatsService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revenue stats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Revenue Payments → GET /api/revenue/payments ──
export const getRevenuePayments = async (req, res) => {
  try {
    const data = await getRevenuePaymentsService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revenue payments error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Tenant Billing Detail → GET /api/revenue/tenant/:tenantId ──
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

// ── Invoice URL → GET /api/revenue/invoice/:paymentId ──
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
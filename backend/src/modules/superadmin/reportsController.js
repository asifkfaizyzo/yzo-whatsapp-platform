// backend/src/modules/superadmin/reportsController.js

import {
  getReportKPIsService,
  getReportMessagesService,
  getReportDeliveryService,
  getReportTenantsService,
  getReportSystemHealthService
} from './reportsService.js';

export const getReportKPIs = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getReportKPIsService({ startDate, endDate });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching report KPIs:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch report KPIs' });
  }
};

export const getReportMessages = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getReportMessagesService({ startDate, endDate });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching report messages:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch message trends' });
  }
};

export const getReportDelivery = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getReportDeliveryService({ startDate, endDate });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching report delivery:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch delivery stats' });
  }
};

export const getReportTenants = async (req, res) => {
  try {
    const { startDate, endDate, search, planFilter } = req.query;
    const data = await getReportTenantsService({ startDate, endDate, search, planFilter });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching report tenants:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch tenant activity' });
  }
};

export const getReportSystemHealth = async (req, res) => {
  try {
    const data = await getReportSystemHealthService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching report system health:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch system health' });
  }
};

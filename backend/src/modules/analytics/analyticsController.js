// backend/src/modules/analytics/analyticsController.js

import {
  getOverviewStatsService,
  getFunnelDataService,
  getTrafficDataService,
  getCampaignsDataService,
  getAgentPerformanceDataService,
  getFilterOptionsService,
  exportAnalyticsDataService
} from './analyticsService.js';

export const getOverview = async (req, res, next) => {
  try {
    const data = await getOverviewStatsService(req.tenantId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getFunnel = async (req, res, next) => {
  try {
    const data = await getFunnelDataService(req.tenantId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getTraffic = async (req, res, next) => {
  try {
    const data = await getTrafficDataService(req.tenantId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCampaigns = async (req, res, next) => {
  try {
    const data = await getCampaignsDataService(req.tenantId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAgents = async (req, res, next) => {
  try {
    const data = await getAgentPerformanceDataService(req.tenantId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getFilters = async (req, res, next) => {
  try {
    const data = await getFilterOptionsService(req.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const exportData = async (req, res, next) => {
  try {
    const csvString = await exportAnalyticsDataService(req.tenantId, req.query);
    const filename = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
};

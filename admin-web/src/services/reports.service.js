// admin-web/src/services/reports.service.js

import api from '../lib/axios';

/**
 * Fetch Performance KPI cards data
 */
export const fetchReportKPIs = async (params = {}) => {
  const response = await api.get('/reports/kpis', { params });
  return response.data;
};

/**
 * Fetch Message Volume & Trends data
 */
export const fetchReportMessages = async (params = {}) => {
  const response = await api.get('/reports/messages', { params });
  return response.data;
};

/**
 * Fetch Delivery Performance data
 */
export const fetchReportDelivery = async (params = {}) => {
  const response = await api.get('/reports/delivery', { params });
  return response.data;
};

/**
 * Fetch Tenant Activity & Usage data
 */
export const fetchReportTenants = async (params = {}) => {
  const response = await api.get('/reports/tenants', { params });
  return response.data;
};

/**
 * Fetch System Health data
 */
export const fetchReportSystemHealth = async () => {
  const response = await api.get('/reports/system-health');
  return response.data;
};

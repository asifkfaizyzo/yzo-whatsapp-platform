// tenant-web/src/services/analytics.service.js

import api from "../lib/axios";

const ANALYTICS_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api2/analytics`;

export const getAnalyticsOverview = async (params) => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/overview`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to load overview analytics" };
  }
};

export const getAnalyticsFunnel = async (params) => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/funnel`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to load funnel analytics" };
  }
};

export const getAnalyticsTraffic = async (params) => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/traffic`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to load traffic analytics" };
  }
};

export const getAnalyticsCampaigns = async (params) => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/campaigns`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to load campaign reports" };
  }
};

export const getAnalyticsAgents = async (params) => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/agents`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to load agent leaderboard" };
  }
};

export const getAnalyticsFilters = async () => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/filters`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to load filter options" };
  }
};

export const downloadAnalyticsCSV = async (params) => {
  try {
    const response = await api.get(`${ANALYTICS_BASE_URL}/export`, {
      params,
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `analytics-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { success: true };
  } catch (error) {
    return { success: false, message: "Failed to download CSV report" };
  }
};

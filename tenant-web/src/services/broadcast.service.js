import api from "../lib/axios";

const BROADCAST_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api9`;

// 1. Get all campaigns
export const getBroadcasts = async () => {
  try {
    const response = await api.get(`${BROADCAST_BASE_URL}/`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to fetch broadcasts" };
  }
};

// 2. Get campaign stats and recipients list
export const getBroadcastStats = async (campaignId) => {
  try {
    const response = await api.get(`${BROADCAST_BASE_URL}/${campaignId}/stats`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to fetch campaign stats" };
  }
};

// 3. Launch/Schedule a new campaign
export const launchBroadcast = async (campaignData) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/launch`, campaignData);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to launch broadcast" };
  }
};

// 4. Cancel a scheduled or processing campaign
export const cancelBroadcast = async (campaignId) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/${campaignId}/cancel`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to cancel broadcast" };
  }
};
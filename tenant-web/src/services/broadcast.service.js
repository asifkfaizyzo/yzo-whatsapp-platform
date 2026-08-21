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

// 2. Get campaign stats summary
export const getBroadcastStats = async (campaignId) => {
  try {
    const response = await api.get(`${BROADCAST_BASE_URL}/${campaignId}/stats`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to fetch campaign stats" };
  }
};

// 3. Get Paginated & Filterable Recipient Delivery Logs with Search
export const getBroadcastRecipients = async (campaignId, params = {}) => {
  try {
    const response = await api.get(`${BROADCAST_BASE_URL}/${campaignId}/recipients`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to fetch recipient logs" };
  }
};

// 4. Export Recipient Delivery Report to CSV
export const exportBroadcastRecipients = async (campaignId) => {
  try {
    const response = await api.get(`${BROADCAST_BASE_URL}/${campaignId}/export`, {
      responseType: 'blob'
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to export recipient logs" };
  }
};

// 5. Smart Retry Failed Recipients
export const retryFailedBroadcast = async (campaignId) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/${campaignId}/retry-failed`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to retry failed recipients" };
  }
};

// 6. Pause an active sending campaign
export const pauseBroadcast = async (campaignId) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/${campaignId}/pause`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to pause campaign" };
  }
};

// 7. Resume a paused campaign
export const resumeBroadcast = async (campaignId) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/${campaignId}/resume`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to resume campaign" };
  }
};

// 8. Launch/Schedule a new campaign
export const launchBroadcast = async (campaignData) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/launch`, campaignData);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to launch broadcast" };
  }
};

// 9. Cancel a scheduled or processing campaign
export const cancelBroadcast = async (campaignId) => {
  try {
    const response = await api.post(`${BROADCAST_BASE_URL}/${campaignId}/cancel`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to cancel broadcast" };
  }
};
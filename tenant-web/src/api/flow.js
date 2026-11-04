// tenant-web/src/api/flow.js (do not remove this comment)
import api from "./axios";

const FLOW_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/tenant`;

const flowService = {

  getAllFlows: async () => {
    const res = await api.get(`${FLOW_BASE_URL}/flows`);
    return res.data;
  },

  getFlow: async (flowId) => {
    const res = await api.get(`${FLOW_BASE_URL}/flows/${flowId}`);
    return res.data;
  },

  createFlow: async (data) => {
    const res = await api.post(`${FLOW_BASE_URL}/flows`, data);
    return res.data;
  },

  saveFlow: async (flowId, data) => {
    const res = await api.put(`${FLOW_BASE_URL}/flows/${flowId}`, data);
    return res.data;
  },

  deleteFlow: async (flowId) => {
    const res = await api.delete(`${FLOW_BASE_URL}/flows/${flowId}`);
    return res.data;
  },

  toggleFlow: async (flowId, isActive) => {
    const res = await api.patch(
      `${FLOW_BASE_URL}/flows/${flowId}/toggle`,
      { isActive }
    );
    return res.data;
  },

  setDefault: async (flowId) => {
    const res = await api.patch(`${FLOW_BASE_URL}/flows/${flowId}/set-default`);
    return res.data;
  },

  unsetDefault: async (flowId) => {
    const res = await api.patch(`${FLOW_BASE_URL}/flows/${flowId}/unset-default`);
    return res.data;
  },

  addKeywords: async (flowId, keywords) => {
    const res = await api.post(
      `${FLOW_BASE_URL}/flows/${flowId}/keywords`,
      { keywords }
    );
    return res.data;
  },

  removeKeyword: async (keywordId) => {
    const res = await api.delete(
      `${FLOW_BASE_URL}/flows/keywords/${keywordId}`
    );
    return res.data;
  },

  getKeywords: async (flowId) => {
    const res = await api.get(`${FLOW_BASE_URL}/flows/${flowId}/keywords`);
    return res.data;
  },

  uploadFlowMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post(`${FLOW_BASE_URL}/flows/media/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};

export default flowService;
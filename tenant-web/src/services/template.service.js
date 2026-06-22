import api from "../lib/axios";

const TEMPLATE_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api8`;

// 1. Get all templates
export const getTemplates = async () => {
  try {
    const response = await api.get(`${TEMPLATE_BASE_URL}/`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to fetch templates" };
  }
};

// 2. Submit new template
export const createTemplate = async (templateData) => {
  try {
    const response = await api.post(`${TEMPLATE_BASE_URL}/create`, templateData);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to create template" };
  }
};

// 3. Sync from Meta Account
export const syncTemplates = async () => {
  try {
    const response = await api.post(`${TEMPLATE_BASE_URL}/sync`);
    return { success: true, data: response.data.data, count: response.data.count };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to sync templates" };
  }
};

// 4. Delete template
export const deleteTemplate = async (templateId) => {
  try {
    const response = await api.delete(`${TEMPLATE_BASE_URL}/${templateId}`);
    return { success: true, message: response.data.message };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to delete template" };
  }
};
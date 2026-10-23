import api from '../lib/axios';

/**
 * Fetch list of quick replies with filtering and pagination
 * @param {Object} params - { search, category, scope, page, limit, includeInactive }
 */
export const getQuickReplies = async (params = {}) => {
  try {
    const response = await api.get('/quick-replies', { params });
    return {
      success: true,
      data: response.data.data,
      pagination: response.data.pagination,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch quick replies',
      data: [],
    };
  }
};

/**
 * Fetch a single quick reply by shortcut (active only)
 * @param {string} shortcut
 */
export const getQuickReplyByShortcut = async (shortcut) => {
  try {
    const cleanShortcut = shortcut.replace(/^\/+/, '');
    const response = await api.get(`/quick-replies/by-shortcut/${encodeURIComponent(cleanShortcut)}`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Quick reply not found',
      data: null,
    };
  }
};

/**
 * Fetch single quick reply by ID
 * @param {string} id
 */
export const getQuickReplyById = async (id) => {
  try {
    const response = await api.get(`/quick-replies/${id}`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch quick reply',
      data: null,
    };
  }
};

/**
 * Create a new quick reply
 * @param {FormData} formData
 */
export const createQuickReply = async (formData) => {
  try {
    const response = await api.post('/quick-replies', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return {
      success: true,
      data: response.data.data,
      message: response.data.message || 'Quick reply created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to create quick reply',
    };
  }
};

/**
 * Update an existing quick reply
 * @param {string} id
 * @param {FormData} formData
 */
export const updateQuickReply = async (id, formData) => {
  try {
    const response = await api.put(`/quick-replies/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return {
      success: true,
      data: response.data.data,
      message: response.data.message || 'Quick reply updated successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to update quick reply',
    };
  }
};

/**
 * Delete a quick reply
 * @param {string} id
 */
export const deleteQuickReply = async (id) => {
  try {
    const response = await api.delete(`/quick-replies/${id}`);
    return {
      success: true,
      data: response.data.data,
      message: response.data.message || 'Quick reply deleted successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to delete quick reply',
    };
  }
};

/**
 * Get distinct quick reply categories for the tenant
 */
export const getQuickReplyCategories = async () => {
  try {
    const response = await api.get('/quick-replies/categories');
    return {
      success: true,
      data: response.data.data || [],
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error.response?.data?.message || 'Failed to fetch categories',
    };
  }
};

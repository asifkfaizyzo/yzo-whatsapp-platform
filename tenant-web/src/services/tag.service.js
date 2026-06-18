// src/services/tag.service.js
import api from "../lib/axios";

const TAGS_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api7`;

/**
 * Fetch all tags for the logged-in tenant (includes assigned user list)
 */
export const getTags = async () => {
  try {
    const response = await api.get(`${TAGS_BASE_URL}/get-all-tag`);
    return {
      success: true,
      data: response.data.data, // Array of tags
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch tags",
    };
  }
};

/**
 * Create a new tag
 */
export const createTag = async ({ name, priority, description }) => {
  try {
    const response = await api.post(`${TAGS_BASE_URL}/createtag`, {
      name,
      priority: parseInt(priority, 10),
      description,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to create tag",
    };
  }
};

/**
 * Map user to tag
 */
export const assignUserToTag = async (tagId, userId) => {
  try {
    const response = await api.post(`${TAGS_BASE_URL}/${tagId}/assign-user`, { userId });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to assign user to tag",
    };
  }
};

/**
 * Remove user from tag
 */
export const removeUserFromTag = async (tagId, userId) => {
  try {
    const response = await api.delete(`${TAGS_BASE_URL}/${tagId}/users/${userId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to remove user from tag",
    };
  }
};

import api from "../lib/axios";

const CONV_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api5`;

/**
 * Get or create a conversation for a contact
 */
export const createConversation = async (contactId) => {
  try {
    const response = await api.post(`${CONV_BASE_URL}/create-conversation`, { contactId });
    return {
      success: true,
      data: response.data.conversation, // The conversation object
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to create conversation",
    };
  }
};

/**
 * Get all conversations assigned to the logged-in agent/user
 */
export const getAssignedConversations = async (page = 1, limit = 20, filter = "all") => {
  try {
    const response = await api.get(`${CONV_BASE_URL}/assigned`, {
      params: { page, limit, filter },
    });
    return {
      success: true,
      data: response.data.conversations || response.data.data, // Check structure returned by backend
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch conversations",
    };
  }
};

/**
 * Get messages for a specific conversation
 */
export const getConversationMessages = async (conversationId, limit = 30, before = null) => {
  try {
    const response = await api.get(`${CONV_BASE_URL}/getmessage/${conversationId}`, {
      params: { limit, before },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch messages",
    };
  }
};

/**
 * Update the status of a conversation (e.g., OPEN, RESOLVED, CLOSED)
 */
export const updateConversationStatus = async (conversationId, status) => {
  try {
    const response = await api.patch(`${CONV_BASE_URL}/status/${conversationId}`, { status });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to update conversation status",
    };
  }
};

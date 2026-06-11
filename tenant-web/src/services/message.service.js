import api from "../lib/axios";

const MSG_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api6`;

/**
 * Send a message to a conversation
 */
export const sendMessage = async (conversationId, message) => {
  try {
    const response = await api.post(`${MSG_BASE_URL}/send`, {
      conversationId,
      message,
    });
    return {
      success: true,
      data: response.data.data, // The newly created message object
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to send message",
    };
  }
};

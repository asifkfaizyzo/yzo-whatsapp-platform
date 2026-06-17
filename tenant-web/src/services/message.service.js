import api from "../lib/axios";

const MSG_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api6`;

/**
 * Send a message to a contact (tenant/user → contact direction)
 * @param {string} contactId - The contact's ID
 * @param {string} text - The message text
 */
export const sendMessage = async (contactId, text) => {
  try {
    const response = await api.post(`${MSG_BASE_URL}/contacts/${contactId}/messages`, {
      text,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to send message",
    };
  }
};

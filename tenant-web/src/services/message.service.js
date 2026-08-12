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


/**
 * Send a media message (image, file, video, audio, voice)
 * @param {string} contactId - The contact's ID
 * @param {FormData} formData - FormData with file, conversationId, caption
 */
export const sendMediaMessage = async (contactId, formData) => {
  try {
    const response = await api.post(
      `${MSG_BASE_URL}/contacts/${contactId}/messages/media`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || "Failed to send media",
    };
  }
};



/**
 * Delete a message (soft delete)
 * @param {string} messageId - The message ID to delete
 */
export const deleteMessage = async (messageId) => {
  try {
    const response = await api.delete(`${MSG_BASE_URL}/${messageId}`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to delete message",
    };
  }
};



//sendLocation
const WA_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api2/whatsapp`;

export const sendLocation = async ({
  to,
  latitude,
  longitude,
  name,
  address,
  conversationId,
}) => {
  try {
    const response = await api.post(`${WA_BASE_URL}/send-location`, {
      to,
      latitude,
      longitude,
      ...(name           && { name }),
      ...(address        && { address }),
      ...(conversationId && { conversationId }),
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to send location",
    };
  }
};
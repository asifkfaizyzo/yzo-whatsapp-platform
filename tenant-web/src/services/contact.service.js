// src/services/contact.service.js
import api from "../lib/axios";

// Dynamically target the contact routes (e.g., http://localhost:3000/api4)
const CONTACTS_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api4`;

/**
 * Fetch all contacts for the logged-in tenant
 */
export const getContacts = async (page = 1, limit = 10, search = "", filter = "all", channel = "ALL") => {
  try {
    const params = { page, limit, search, filter };
    if (channel && channel !== "ALL") {
      params.channel = channel;
    }
    const response = await api.get(`${CONTACTS_BASE_URL}/get-all-contacts`, {
      params
    });
    return {
      success: true,
      data: response.data.data, // Contains count, totalPages, currentPage, limit, channelCounts, and contacts
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch contacts",
    };
  }
};

/**
 * Create a new WhatsApp contact
 */
export const createContact = async (contactData) => {
  try {
    const response = await api.post(`${CONTACTS_BASE_URL}/create-contact`, {
      name: contactData.name,
      phone: contactData.phone,
      countryCode: contactData.countryCode,
      email: contactData.email,
      tags: contactData.tags,
      company: contactData.company,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to create contact",
    };
  }
};

/**
 * Delete a contact by ID
 */
export const deleteContact = async (contactId) => {
  try {
    const response = await api.delete(`${CONTACTS_BASE_URL}/delete-contact/${contactId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to delete contact",
    };
  }
};



/**
 * Bulk delete contacts by IDs
 */
/**
 * Bulk delete contacts by IDs or Filters
 */
export const bulkDeleteContacts = async (contactIds = [], mode = 'selected', filters = {}, confirmation = '') => {
  try {
    const payload = { mode };
    if (mode === 'selected') payload.contactIds = contactIds;
    if (mode === 'filter') payload.filters = filters;
    if (mode === 'all') payload.confirmation = confirmation;

    // ✅ Uses ${CONTACTS_BASE_URL}/bulk-delete (Matches all other working routes in this file)
    const response = await api.post(`${CONTACTS_BASE_URL}/bulk-delete`, payload);
    return response.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Failed to bulk delete contacts' };
  }
};


/**
 * Update a contact by ID
 */
export const updateContact = async (contactId, contactData) => {
  try {
    const response = await api.put(`${CONTACTS_BASE_URL}/update-contact/${contactId}`, {
      name: contactData.name,
      phone: contactData.phone,
      countryCode: contactData.countryCode,
      email: contactData.email,
      tags: contactData.tags,
      company: contactData.company,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to update contact",
    };
  }
};

/**
 * Block a contact by ID
 */
export const blockContact = async (contactId) => {
  try {
    const response = await api.patch(`${CONTACTS_BASE_URL}/block-contact/${contactId}`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to block contact",
    };
  }
};

/**
 * Unblock a contact by ID
 */
export const unblockContact = async (contactId) => {
  try {
    const response = await api.patch(`${CONTACTS_BASE_URL}/unblock-contact/${contactId}`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to unblock contact",
    };
  }
};

/**
 * Import contacts from a CSV file
 */
export const importContacts = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`${CONTACTS_BASE_URL}/import`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to import contacts",
    };
  }
};



/**
 * Get CSV import guidelines
 */
export const getImportGuidelines = async () => {
  try {
    const response = await api.get(`${CONTACTS_BASE_URL}/import-guidelines`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to load import guidelines",
    };
  }
};




/**
 * Download sample CSV template
 */
export const downloadSampleCSV = async () => {
  try {
    const response = await api.get(`${CONTACTS_BASE_URL}/sample-csv`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sudoreply_contacts_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to download sample CSV",
    };
  }
};



/**
 * Add a tag to a contact
 */
export const addTagToContact = async (contactId, tagId) => {
  try {
    const response = await api.post(`${CONTACTS_BASE_URL}/${contactId}/tags`, { tagId });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to add tag to contact",
    };
  }
};

// ── Remove Tag from Contact ──
export const removeTagFromContact = async (contactId, tagId) => {
  try {
    const res = await api.delete(`${CONTACTS_BASE_URL}/${contactId}/tags/${tagId}`);
    return {
      success: true,
      data: res.data
    };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to remove tag",
    };
  }
};
// src/services/contact.service.js
import api from "../lib/axios";

// Dynamically target the contact routes (e.g., http://localhost:3000/api4)
const CONTACTS_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api4`;

/**
 * Fetch all contacts for the logged-in tenant
 */
export const getContacts = async (page = 1, limit = 10, search = "", filter = "all") => {
  try {
    const response = await api.get(`${CONTACTS_BASE_URL}/get-all-contacts`, {
      params: { page, limit, search, filter }
    });
    return {
      success: true,
      data: response.data.data, // Contains count, totalPages, currentPage, limit, and contacts
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


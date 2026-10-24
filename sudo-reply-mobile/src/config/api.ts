/**
 * Base URL for the Sudo Reply backend.
 * - Physical device: use your machine's LAN IP (e.g. http://192.168.29.69:5000)
 * - Android emulator: http://10.0.2.2:5000
 * - iOS simulator:    http://localhost:5000
 */
const FALLBACK_URL = 'http://192.168.29.69:5000';

export const API_BASE_URL = 'http://192.168.29.69:5000';

/**
 * All API endpoint paths used by the mobile app.
 * Grouped by module. Paths are relative to API_BASE_URL.
 */
export const ENDPOINTS = {
  // ── Auth (Agent/User) ──
  auth: {
    login:            '/api3/login',
    logout:           '/api3/logout',
    refreshToken:     '/api3/refresh-token',
    forgotPassword:   '/api3/forgot-password',
    resetPassword:    '/api3/reset-password',
    me:               '/api3/me',
    changePassword:   '/api3/change-password',
    availability:     '/api3/availability',
    dashboardStats:   '/api3/dashboard-stats',
    unreadCount:      '/api3/unread-count',
  },

  // ── Auth (Tenant) ──
  tenantAuth: {
    login:            '/api2/login',
    logout:           '/api2/logout',
    refreshToken:     '/api2/refresh-token',
    forgotPassword:   '/api2/forgot-ten-password',
    resetPassword:    '/api2/reset-ten-password',
    me:               '/api2/me',
    changePassword:   '/api2/change-password',
  },

  // ── Contacts ──
  contacts: {
    create:           '/api4/create-contact',
    getAll:           '/api4/get-all-contacts',
    getById:          (id: string) => `/api4/get-contact/${id}`,
    update:           (id: string) => `/api4/update-contact/${id}`,
    delete:           (id: string) => `/api4/delete-contact/${id}`,
    block:            (id: string) => `/api4/block-contact/${id}`,
    unblock:          (id: string) => `/api4/unblock-contact/${id}`,
    importPhone:      '/api4/import-phone',
    addTag:           (contactId: string) => `/api4/${contactId}/tags`,
    removeTag:        (contactId: string, tagId: string) => `/api4/${contactId}/tags/${tagId}`,
    byUser:           (userId: string) => `/api4/by-user/${userId}`,
  },

  // ── Conversations ──
  conversations: {
    create:           '/api5/create-conversation',
    getByContact:     (contactId: string) => `/api5/conversation/${contactId}`,
    assigned:         '/api5/assigned',
    getMessages:      (conversationId: string) => `/api5/getmessage/${conversationId}`,
    updateStatus:     (id: string) => `/api5/status/${id}`,
    archive:          (id: string) => `/api5/archive/${id}`,
    unarchive:        (id: string) => `/api5/unarchive/${id}`,
    delete:           (id: string) => `/api5/delete/${id}`,
    archived:         '/api5/archived',
    markRead:         (id: string) => `/api5/mark-read/${id}`,
    bulkReassign:     '/api5/bulk-reassign',
    media:            (id: string) => `/api5/media/${id}`,
    pin:              (id: string) => `/api5/pin/${id}`,
  },

  // ── Tags ──
  tags: {
    getAll:           '/api7/get-all-tag',
  },

  // ── Templates ──
  templates: {
    getAll:           '/api8/',
  },

  // ── Broadcasts (Campaigns) ──
  broadcasts: {
    getAll:           '/api9/',
    getById:          (id: string) => `/api9/${id}`,
    create:           '/api9/',
  },
} as const; 
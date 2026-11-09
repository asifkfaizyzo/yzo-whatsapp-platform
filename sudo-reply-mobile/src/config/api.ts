// sudo-reply-mobile/src/config/api.ts
const FALLBACK_URL = 'http://192.168.29.69:5000';
// AFTER (production)
// export const API_BASE_URL = 'https://api.sudoreply.com';
// BEFORE (local dev)
export const API_BASE_URL = 'http://192.168.29.69:5000';

export const ENDPOINTS = {
  // ── Agent (User) Auth & Profile ── mounted at /tenant/user
  auth: {
    login:              '/tenant/user/login-user',
    logout:             '/tenant/user/logout-user',
    refreshToken:       '/tenant/user/refresh-user-access',
    forgotPassword:     '/tenant/user/forgot-usr-password',
    resetPassword:      '/tenant/user/reset-usr-password',
    me:                 '/tenant/user/me',
    changePassword:     '/tenant/user/change-password',
    availability:       '/tenant/user/availability',
    dashboardStats:     '/tenant/user/dashboard-stats',
    unreadCount:        '/tenant/user/unread-count',
    googleLogin:        '/tenant/user/google-login',
    pushToken:          '/tenant/user/push-token',
    notificationPrefs:  '/tenant/user/notification-preferences',
    myAssignedContacts: '/tenant/user/my-assigned-contacts',
  },

  // ── Tenant Auth ── mounted at /tenant (via tenant.routes.js → tenant.auth.routes.js)
  tenantAuth: {
    login:          '/tenant/login',
    logout:         '/tenant/logout',
    refreshToken:   '/tenant/refresh-token',
    forgotPassword: '/tenant/forgot-ten-password',
    resetPassword:  '/tenant/reset-ten-password',
    googleLogin:    '/tenant/google-login',
    facebookLogin:  '/tenant/facebook-login',
    // ⚠️ me & changePassword likely in tenant.profile.routes.js — confirm exact sub-path
    me:             '/tenant/me',
    changePassword: '/tenant/change-password',
  },

  // ── Contacts ── mounted at /tenant/contacts
  contacts: {
    create:           '/tenant/contacts/create-contact',
    getAll:           '/tenant/contacts/get-all-contacts',
    getById:          (id: string) => `/tenant/contacts/get-contact/${id}`,
    update:           (id: string) => `/tenant/contacts/update-contact/${id}`,
    delete:           (id: string) => `/tenant/contacts/delete-contact/${id}`,
    block:            (id: string) => `/tenant/contacts/block-contact/${id}`,
    unblock:          (id: string) => `/tenant/contacts/unblock-contact/${id}`,
    importPhone:      '/tenant/contacts/import-phone',
    addTag:           (contactId: string) => `/tenant/contacts/${contactId}/tags`,
    removeTag:        (contactId: string, tagId: string) => `/tenant/contacts/${contactId}/tags/${tagId}`,
    byUser:           (userId: string) => `/tenant/contacts/by-user/${userId}`,
    bulkDelete:       '/tenant/contacts/bulk-delete',
    importGuidelines: '/tenant/contacts/import-guidelines',
    sampleCsv:        '/tenant/contacts/sample-csv',
  },

  // ── Conversations ── mounted at /tenant/conversations
  conversations: {
    create:       '/tenant/conversations/create-conversation',
    getByContact: (contactId: string) => `/tenant/conversations/conversation/${contactId}`,
    assigned:     '/tenant/conversations/assigned',
    getMessages:  (conversationId: string) => `/tenant/conversations/getmessage/${conversationId}`,
    updateStatus: (id: string) => `/tenant/conversations/status/${id}`,
    archive:      (id: string) => `/tenant/conversations/archive/${id}`,
    unarchive:    (id: string) => `/tenant/conversations/unarchive/${id}`,
    delete:       (id: string) => `/tenant/conversations/delete/${id}`,
    archived:     '/tenant/conversations/archived',
    markRead:     (id: string) => `/tenant/conversations/mark-read/${id}`,
    bulkReassign: '/tenant/conversations/bulk-reassign',
    media:        (id: string) => `/tenant/conversations/media/${id}`,
    pin:          (id: string) => `/tenant/conversations/pin/${id}`,
  },

  // ── Messages (send) ── mounted at /tenant/messages
  messages: {
    sendText:     (contactId: string) => `/tenant/messages/contacts/${contactId}/messages`,
    sendMedia:    (contactId: string) => `/tenant/messages/contacts/${contactId}/messages/media`,
    delete:       (messageId: string) => `/tenant/messages/${messageId}`,
    sendTemplate: (contactId: string) => `/tenant/messages/contacts/${contactId}/messages/template`,
    // ⚠️ refreshMedia was at /api6/refresh/:id — not present in new message.routes.js
  },

  // ── Tags ── mounted at /tenant/tags
  tags: {
    getAll: '/tenant/tags/get-all-tag',
  },

  // ── Templates ── mounted at /tenant/templates
  templates: {
    getAll: '/tenant/templates/',
  },

  // ── Broadcasts ── mounted at /tenant/broadcasts
  broadcasts: {
    getAll:          '/tenant/broadcasts/',
    getStats:        (id: string) => `/tenant/broadcasts/${id}/stats`,
    getRecipients:   (id: string) => `/tenant/broadcasts/${id}/recipients`,
    exportRecipients:(id: string) => `/tenant/broadcasts/${id}/export`,
    create:          '/tenant/broadcasts/launch',
    cancel:          (id: string) => `/tenant/broadcasts/${id}/cancel`,
    pause:           (id: string) => `/tenant/broadcasts/${id}/pause`,
    resume:          (id: string) => `/tenant/broadcasts/${id}/resume`,
    retryFailed:     (id: string) => `/tenant/broadcasts/${id}/retry-failed`,
  },

  // ── Quick Replies ── mounted at /tenant/quick-replies
  quickReplies: {
    getAll:        '/tenant/quick-replies/',
    getByShortcut: (shortcut: string) => `/tenant/quick-replies/by-shortcut/${shortcut}`,
    categories:    '/tenant/quick-replies/categories',
  },

  // ── Notifications ── mounted at /tenant/notifications
  notifications: {
    getAll:     '/tenant/notifications/',
    paginated:  '/tenant/notifications/paginated',
    markRead:   (id: string) => `/tenant/notifications/${id}/read`,
    markAllRead:'/tenant/notifications/read-all',
    clearAll:   '/tenant/notifications/clear-all',
    delete:     (id: string) => `/tenant/notifications/${id}`,
  },
} as const;
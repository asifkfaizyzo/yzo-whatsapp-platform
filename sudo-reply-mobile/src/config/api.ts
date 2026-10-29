const FALLBACK_URL = 'http://192.168.29.69:5000';

export const API_BASE_URL = 'http://192.168.29.69:5000';

export const ENDPOINTS = {
  auth: {
    login: '/api3/login-user',
    logout: '/api3/logout-user',
    refreshToken: '/api3/refresh-user-access',
    forgotPassword: '/api3/forgot-usr-password',
    resetPassword: '/api3/reset-usr-password',
    me: '/api3/me',
    changePassword: '/api3/change-password',
    availability: '/api3/availability',
    dashboardStats: '/api3/dashboard-stats',
    unreadCount: '/api3/unread-count',
    googleLogin: '/api3/google-login',
    pushToken: '/api3/push-token',
  },

  tenantAuth: {
    login:            '/api2/login',
    logout:           '/api2/logout',
    refreshToken:     '/api2/refresh-token',
    forgotPassword:   '/api2/forgot-ten-password',
    resetPassword:    '/api2/reset-ten-password',
    me:               '/api2/me',
    changePassword:   '/api2/change-password',
    googleLogin:      '/api2/google-login',
  },

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

  // ── Messages (send) ──
  messages: {
    sendText:         (contactId: string) => `/api6/contacts/${contactId}/messages`,
    sendMedia:        (contactId: string) => `/api6/contacts/${contactId}/messages/media`,
    delete:           (messageId: string) => `/api6/${messageId}`,
    refreshMedia:     (messageId: string) => `/api6/refresh/${messageId}`,
    sendTemplate: (contactId: string) => `/api6/contacts/${contactId}/messages/template`,
  },

  tags: {
    getAll:           '/api7/get-all-tag',
  },

  templates: {
  getAll: '/api8/',
},

  broadcasts: {
    getAll:           '/api9/',
    getById:          (id: string) => `/api9/${id}`,
    create:           '/api9/',
  },
   quickReplies: {
    getAll:           '/api2/quick-replies/',
    getByShortcut:    (shortcut: string) => `/api2/quick-replies/by-shortcut/${shortcut}`,
    categories:       '/api2/quick-replies/categories',
  },
} as const;
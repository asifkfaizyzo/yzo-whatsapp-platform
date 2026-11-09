// tenant-web/src/pages/Inbox/comps/utils/inboxHelpers.js (do not remove this comment)

/**
 * Format the last message of a conversation into a short preview string.
 *
 * NOTE: Emojis removed per project convention (no emojis in UI).
 * Consuming components should render Lucide icons based on msg.type
 * if visual indicators are needed (e.g. Phone, Mic, Image, Video,
 * FileText, MapPin in ChatSidebar and ArchivedChatsModal).
 */
export const formatLastMessagePreview = (msg) => {
  if (!msg) return "No messages yet";
  const type = msg.type?.toUpperCase();

  if (type === "CALL") {
    if (msg.status === "MISSED") return "Missed Call";
    if (msg.status === "REJECTED") return "Declined Call";
    if (msg.status === "FAILED") return "Failed Call";
    return msg.direction === "BUSINESS_INITIATED"
      ? "Outgoing Call"
      : "Incoming Call";
  }

  if (type === "AUDIO") return "Voice message";
  if (type === "IMAGE") return msg.caption ? msg.caption : "Photo";
  if (type === "VIDEO") return msg.caption ? msg.caption : "Video";
  if (type === "FILE") return msg.mediaName ? msg.mediaName : "Document";
  if (type === "LOCATION") return "Location";
  if (type === "INTERACTIVE_BUTTONS") return msg.text || "Interactive Message";

  if (!msg.text || msg.text === "Message") return "Text Message";
  return msg.text;
};

/**
 * Check if the 24-hour WhatsApp messaging window has expired.
 * Only evaluates inbound (customer) messages for OPEN conversations.
 * Returns false for RESOLVED/CLOSED chats (banner not relevant).
 */
export const is24hExpired = (chat) => {
  if (!chat) return false;

  // Do NOT show banner if chat is already RESOLVED or CLOSED
  if (chat.status !== "OPEN") return false;

  // Get the MOST RECENT customer message from the end of the messages array
  const inboundMsgs = (chat.messages || []).filter(
    (m) => m.isFromCustomer || m.direction === "INBOUND",
  );
  const lastInboundMsg = inboundMsgs[inboundMsgs.length - 1];

  // Pick the newest incoming message timestamp first, fallback to chat.incomingAt
  const lastCustomerMsgTime = lastInboundMsg?.createdAt || chat.incomingAt;

  // If customer has never messaged, don't expire
  if (!lastCustomerMsgTime) return false;

  const elapsed = Date.now() - new Date(lastCustomerMsgTime).getTime();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  return elapsed > TWENTY_FOUR_HOURS;
};

/**
 * Determine if the current user is allowed to delete a given message.
 * - TENANT (admin): can delete any message
 * - USER (agent): can only delete their own outbound messages
 *
 * @param {object} msg  - The message object
 * @param {object} user - The authenticated user from useAuthStore
 */
export const canDeleteMessage = (msg, user) => {
  if (msg.isDeleted) return false;
  if (user?.type === "TENANT") return true;
  if (user?.type === "USER") {
    if (msg.isFromCustomer) return false;
    return msg.senderId === user?.id;
  }
  return false;
};

/**
 * Extract tag name strings from a contact object.
 * Handles both flat `contact.tags` array and nested `contact.contactTags`
 * relation (where each entry is { tag: { id, name } }).
 */
export const getContactTags = (contact) => {
  if (!contact) return [];
  if (Array.isArray(contact.tags)) return contact.tags;
  if (Array.isArray(contact.contactTags))
    return contact.contactTags.map((ct) => ct.tag?.name || ct.tag || "");
  return [];
};

/**
 * Return Tailwind classes for a tag badge based on its name.
 * Falls back to emerald styling for unrecognized tags.
 */
export const getTagColor = (tag) => {
  if (tag === "Enterprise")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tag === "Interested in pricing")
    return "bg-teal-50 text-teal-700 border-teal-200";
  if (tag === "VIP") return "bg-green-50 text-green-800 border-green-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
};

/**
 * Get the unread message count for a conversation.
 * Returns 0 for the currently active (open) chat — never show badge
 * for the chat the user is looking at.
 *
 * @param {string|number}      conversationId
 * @param {string|number|null} activeChatId
 * @param {object}             unreadMap  - Session-only counts { [convId]: number }
 * @param {Array}              chats      - Full conversations array
 */
export const getUnreadCount = (
  conversationId,
  activeChatId,
  unreadMap,
  chats,
) => {
  // If chat is currently OPEN → always 0
  if (activeChatId && String(activeChatId) === String(conversationId)) {
    return 0;
  }

  // Priority 1: Session-only unread (real-time increments)
  const sessionCount = unreadMap[String(conversationId)];
  if (sessionCount != null && sessionCount > 0) return sessionCount;

  // Priority 2: Backend-persisted unread count
  const chat = chats.find((c) => String(c.id) === String(conversationId));
  return chat?.unreadCount || 0;
};

/**
 * Replace template variables in a quick reply body with live data.
 *
 * Supported variables:
 *   {{contactName}}  → contact.name       (fallback "Customer")
 *   {{contactPhone}} → contact.phone      (fallback "")
 *   {{agentName}}    → authUser.name      (fallback "Agent")
 *   {{companyName}}  → authUser.tenantName (fallback "Our Company")
 *   {{date}}         → today's locale date
 *   {{time}}         → current locale time (HH:MM)
 */
export const interpolateQuickReply = (text, contact, authUser) => {
  if (!text) return "";
  return text
    .replace(/{{contactName}}/gi, contact?.name || "Customer")
    .replace(/{{contactPhone}}/gi, contact?.phone || "")
    .replace(/{{agentName}}/gi, authUser?.name || "Agent")
    .replace(/{{companyName}}/gi, authUser?.tenantName || "Our Company")
    .replace(/{{date}}/gi, new Date().toLocaleDateString())
    .replace(
      /{{time}}/gi,
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
};
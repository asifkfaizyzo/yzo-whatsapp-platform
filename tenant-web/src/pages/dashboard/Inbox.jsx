// src/pages/dashboard/Inbox.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import api from "../../lib/axios";
import EmojiPicker from "emoji-picker-react";
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  Tag,
  CheckCheck,
  MoreVertical,
  MessageSquarePlus,
  X,
  RefreshCw,
  CheckCircle2,
  Mail,
  Building2,
  CalendarDays,
  ArrowDownLeft,
  UserCheck,
  Mic,
  Check,
  Trash2,
  Eye,
  MapPin,
  AlertTriangle,
  ChevronLeft, 
  ChevronRight,
  ShoppingBag,
  Navigation,
  ExternalLink,
  Copy,          
} from "lucide-react";
import {
  getAssignedConversations,
  getConversationMessages,
  createConversation,
  updateConversationStatus,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
  getArchivedConversations,
  bulkReassignConversations,
  markConversationAsRead,
} from "../../services/conversation.service";
import {
  sendMessage,
  sendMediaMessage,
  deleteMessage,
  sendLocation,
} from "../../services/message.service";
import {
  getContacts,
  addTagToContact,
  removeTagFromContact,
} from "../../services/contact.service";
import { useAuthStore } from "../../store/useAuthStore";
import { io } from "socket.io-client";
import { getTags } from "../../services/tag.service";
import { getTenantUsers, assignContact } from "../../services/tenant.service";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

export default function Inbox() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, accessToken } = useAuthStore();

  const userRole = user?.type === "TENANT" ? "admin" : "agent";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlConversationId = searchParams.get("conversationId");
  const filter =
    searchParams.get("filter") || (userRole === "admin" ? "all" : "my");
  const activeTab = searchParams.get("tab") || "all";

  // ── Core State ──
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(urlConversationId || null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});

  // ── Presence & Collision State ──
  const [activeViewers, setActiveViewers] = useState([]);
  const [typingAgents, setTypingAgents] = useState([]);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const prevChatIdRef = useRef(null);

  // ── Media Upload State ──
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileCaption, setFileCaption] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // ── Audio Recording ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── Scroll ──
  const messagesEndRef = useRef(null);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef(null);
  const docInputRef = useRef(null);

    // ── Emoji Picker State ──
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // ── Contact Picker Modal State ──
  const [showContactPickerModal, setShowContactPickerModal] = useState(false);
  const [contactPickerSearch, setContactPickerSearch] = useState("");
  const [selectedContactsToShare, setSelectedContactsToShare] = useState([]);
  const [sendingContact, setSendingContact] = useState(false);

  // ── New Media File Input Refs (WhatsApp-style) ──
  const documentInputRef = useRef(null);
  const photoVideoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // ── Location Modal ──
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name:      "",
    address:   "",
    latitude:  "",
    longitude: "",
  });
  const [locationError, setLocationError]     = useState("");
  const [sendingLocation, setSendingLocation] = useState(false);

  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    const chatContainer = messagesEndRef.current.parentElement;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, activeChatId]);

  // ── New Chat Modal ──
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // ── Assign Tag & User States ──
  const [allTags, setAllTags] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [assigningTag, setAssigningTag] = useState(false);
  const [assigningUser, setAssigningUser] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");

  // ── Bulk Reassign State ──
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState([]);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkTargetUserId, setBulkTargetUserId] = useState("");
  const [bulkReassigning, setBulkReassigning] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const sidebarMenuRef = useRef(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAllChats, setDeletingAllChats] = useState(false);

  // ── Delete Message State ──
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  // ── Image Preview Lightbox State ──
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // ── Right Contact Panel State ──
const [showContactPanel, setShowContactPanel] = useState(() => {
  const saved = localStorage.getItem("inbox_contact_panel_open");
  return saved === "true"; // default: closed
});

// Persist panel state
useEffect(() => {
  localStorage.setItem("inbox_contact_panel_open", String(showContactPanel));
}, [showContactPanel]);

  // ── Archived State ──
  const [showArchived, setShowArchived] = useState(false);
  const [archivedChats, setArchivedChats] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [unarchivingId, setUnarchivingId] = useState(null);

  // ── Conversation Menu State ──
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);
  const [archivingConv, setArchivingConv] = useState(false);
  const convMenuRef = useRef(null);

  // ── Socket ──
  const [socket, setSocket] = useState(null);
  const activeTenantId = user?.type === "TENANT" ? user?.id : user?.tenantId;

  const activeChat =
    chats.find((c) => String(c.id) === String(activeChatId)) || null;

  //     // ── 24h Expired Check Helper ──
  // const is24hExpired = (dateVal) => {
  //   if (!dateVal) return false;
  //   const lastTime = new Date(dateVal).getTime();
  //   if (isNaN(lastTime)) return false;
  //   const hoursDiff = (Date.now() - lastTime) / (1000 * 60 * 60);
  //   return hoursDiff >= 24;
  // };

    // ⭐ Smart 24h Expired Check (Looks ONLY at Customer Messages)
  const is24hExpired = (chat) => {
    if (!chat) return false;

    // 1. Check incomingAt (recorded when customer messages)
    let lastCustomerTime = chat.incomingAt ? new Date(chat.incomingAt).getTime() : null;

    // 2. Fallback: Search messages array for the last customer message
    if (!lastCustomerTime && Array.isArray(chat.messages)) {
      const lastInboundMsg = chat.messages.find(
        (m) => m.isFromCustomer || m.direction === "INBOUND" || m.senderType === "CONTACT"
      );
      if (lastInboundMsg?.createdAt) {
        lastCustomerTime = new Date(lastInboundMsg.createdAt).getTime();
      }
    }

    // 3. If customer NEVER messaged -> Session is EXPIRED by default!
    if (!lastCustomerTime) return true;

    if (isNaN(lastCustomerTime)) return false;

    // 4. Calculate hours difference
    const hoursDiff = (Date.now() - lastCustomerTime) / (1000 * 60 * 60);
    return hoursDiff >= 24;
  };

  // ── Helpers ──
  const formatLastMessagePreview = (msg) => {
    if (!msg) return "No messages yet";
    const type = msg.type?.toUpperCase();

    if (type === "AUDIO") return "🎵 Voice message";
    if (type === "IMAGE") return msg.caption ? `📷 ${msg.caption}` : "📷 Photo";
    if (type === "VIDEO") return msg.caption ? `🎥 ${msg.caption}` : "🎥 Video";
    if (type === "FILE")  return msg.mediaName ? `📄 ${msg.mediaName}` : "📄 Document";
    if (type === "LOCATION") return "📍 Location";
    if (type === "INTERACTIVE_BUTTONS") return msg.text || "Interactive Message";

    if (!msg.text || msg.text === "Message") return "Text Message";
    return msg.text;
  };

  const getContactTags = (contact) => {
    if (!contact) return [];
    if (Array.isArray(contact.tags)) return contact.tags;
    if (Array.isArray(contact.contactTags))
      return contact.contactTags.map((ct) => ct.tag?.name || ct.tag || "");
    return [];
  };

  // ⭐ Get unread count for a conversation
  const getUnreadCount = (conversationId) => {
    // If chat is currently OPEN → always 0 (never show badge for open chat)
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

  const formatTime = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateVal, options) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString(
          undefined,
          options || { weekday: "long", month: "short", day: "numeric" },
        );
  };

  // ── Load Tags and Agents ──
  useEffect(() => {
    const loadTagsAndAgents = async () => {
      const [tagsRes, agentsRes] = await Promise.all([
        getTags(),
        getTenantUsers(),
      ]);
      if (tagsRes.success) setAllTags(tagsRes.data || []);
      if (agentsRes.success) setAllAgents(agentsRes.data || []);
    };
    loadTagsAndAgents();
  }, []);

  // ── Load Conversations ──
  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const res = await getAssignedConversations(1, 50, filter);
      if (res.success) {
        const convList =
          res.data?.conversations ||
          res.data?.data?.conversations ||
          res.data?.data ||
          res.data ||
          [];

        setChats(convList);

        setUnreadMap((prev) => {
          const next = { ...prev };
          convList.forEach((c) => {
            if (next[String(c.id)] == null) next[String(c.id)] = 0;
          });
          return next;
        });

     // ⭐ Use URL param at call time, not as dependency
      const currentUrlConvId = new URLSearchParams(window.location.search).get("conversationId");
      if (!currentUrlConvId && convList.length > 0) {
        setActiveChatId(convList[0].id);
        setSearchParams({ filter, conversationId: convList[0].id });
      } else if (convList.length === 0) {
        setActiveChatId(null);
      }
    }
    if (!silent) setLoading(false);
  },
  [filter, setSearchParams],  // ⭐ REMOVED urlConversationId
);

  // ── Initial Load ──
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);


// ── Clear unread when chat opened ──
useEffect(() => {
  if (!activeChatId) return;
  
  // 1. Reset frontend immediately
  setUnreadMap((prev) => ({ ...prev, [String(activeChatId)]: 0 }));
  
  // 2. ✅ ADD: Also reset backend
  const markAsRead = async () => {
    try {
      await api.patch(
        `${import.meta.env.VITE_BACKEND_URL}/api5/mark-read/${activeChatId}`
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };
  markAsRead();
  
    // 3. Update chats state so sidebar count decreases
  setChats((prev) =>
    prev.map((c) =>
      String(c.id) === String(activeChatId)
        ? { ...c, unreadCount: 0 }
        : c
    )
  );
}, [activeChatId]);

  // ── Reset dropdowns when chat changes ──
  useEffect(() => {
    setSelectedTag("");
    setSelectedAgent("");
  }, [activeChatId]);

  // ── Load Messages ──
  useEffect(() => {
    if (!activeChatId) return;
    const loadMessages = async () => {
      const res = await getConversationMessages(activeChatId, 50);
      if (res.success) setMessages(res.data?.messages || []);
    };
    loadMessages();
  }, [activeChatId]);

  // ── Socket Connection ──
  // FIXED: Added user room joining for USER type + correct dependencies
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_BACKEND_URL;

    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      // Always join tenant room (needed for new_message events for everyone)
      if (activeTenantId) {
        newSocket.emit("join_tenant", activeTenantId);
      }

      // If USER (agent), also join personal user room
      if (user?.type === "USER" && user?.id) {
        newSocket.emit("join_user", user.id);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // FIXED: Added user?.id and user?.type to dependency array
  }, [activeTenantId, accessToken, user?.id, user?.type]);

  // ── Conversation Presence & Live Typing Listeners ──
  useEffect(() => {
    if (!socket) return;

    if (prevChatIdRef.current && String(prevChatIdRef.current) !== String(activeChatId)) {
      socket.emit("leave_conversation", { conversationId: prevChatIdRef.current });
    }

    if (activeChatId) {
      socket.emit("join_conversation", { conversationId: activeChatId });
      prevChatIdRef.current = activeChatId;
    } else {
      prevChatIdRef.current = null;
    }

    setActiveViewers([]);
    setTypingAgents([]);

    const handleViewersUpdated = (data) => {
      if (activeChatId && String(data.conversationId) === String(activeChatId)) {
        setActiveViewers(data.viewers || []);
      }
    };

    const handleTypingUpdated = (data) => {
      if (activeChatId && String(data.conversationId) === String(activeChatId)) {
        setTypingAgents(data.typingAgents || []);
      }
    };

    socket.on("conversation_viewers_updated", handleViewersUpdated);
    socket.on("agent_typing_updated", handleTypingUpdated);

    return () => {
      socket.off("conversation_viewers_updated", handleViewersUpdated);
      socket.off("agent_typing_updated", handleTypingUpdated);
    };
  }, [socket, activeChatId]);

  // ── Socket Event Listeners ──
  useEffect(() => {
    if (!socket) return;

    // ── Handle new message ──
 
    const handleNewMessage = (data) => {
      const { conversationId, message } = data;

      if (!message || typeof message !== "object" || !message.id) {
        return;
      }

      const isFromCustomer = message?.isFromCustomer === true;
      const isCurrentChatOpen =
        activeChatId && String(activeChatId) === String(conversationId);

      // Add message to open chat
      if (isCurrentChatOpen) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        setTimeout(() => scrollToBottom(true), 50);

        // Mark as read for open chat
        if (isFromCustomer) {
          setUnreadMap((prev) => ({ ...prev, [String(conversationId)]: 0 }));
          setChats((prev) =>
            prev.map((c) =>
              String(c.id) === String(conversationId)
                ? { ...c, unreadCount: 0 }
                : c
            )
          );

          api.patch(
            `${import.meta.env.VITE_BACKEND_URL}/api5/mark-read/${conversationId}`
          ).catch((err) => console.error("Mark read failed:", err));
        }
      }

      // Update unread count for non-open chats
      if (isFromCustomer && !isCurrentChatOpen) {
        setUnreadMap((prev) => ({
          ...prev,
          [String(conversationId)]: (prev[String(conversationId)] || 0) + 1,
        }));
      }

      // ⭐⭐⭐ CRITICAL FIX: Update chats WITHOUT reordering unless truly new
      setChats((prevChats) => {
        const exists = prevChats.some(
          (c) => String(c.id) === String(conversationId),
        );
        if (!exists) {
          setTimeout(() => {
            loadConversations(true);
          }, 0);
          return prevChats;
        }

        // ⭐ CHECK: Is this message already the latest in the chat?
        const currentChat = prevChats.find(
          (c) => String(c.id) === String(conversationId)
        );
        const currentLatestMsgId = currentChat?.messages?.[0]?.id;

        // ⭐ CHECK: Is this message OLDER than what we have?
        const currentLatestTime = currentChat?.messages?.[0]?.createdAt
          ? new Date(currentChat.messages[0].createdAt).getTime()
          : 0;
        const newMessageTime = message.createdAt
          ? new Date(message.createdAt).getTime()
          : Date.now();

        // If duplicate OR older message → don't touch the list
        if (currentLatestMsgId === message.id || newMessageTime < currentLatestTime) {
          return prevChats;
        }

        const msgCreatedAt = message.createdAt || new Date().toISOString();

        // Update the specific chat
        const updated = prevChats.map((c) => {
          if (String(c.id) === String(conversationId)) {
            return {
              ...c,
              status: "OPEN",
              lastMessageAt: msgCreatedAt,
              updatedAt: msgCreatedAt,
              messages: [
                {
                  id: message.id,
                  text: message.text,
                  createdAt: msgCreatedAt,
                },
              ],
            };
          }
          return c;
        });

        // Reorder (only when we have a truly new message)
        return updated.sort((a, b) => {
          const dateA = a.messages?.[0]?.createdAt || a.updatedAt;
          const dateB = b.messages?.[0]?.createdAt || b.updatedAt;
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
      });
    };


// ── Handle deleted message ──
    const handleMessageDeleted = ({ messageId, conversationId: convId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                isDeleted: true,
                text: null,
                mediaUrl: null,
                caption: null,
              }
            : m,
        ),
      );

      setChats((prevChats) =>
        prevChats.map((c) => {
          if (String(c.id) === String(convId)) {
            return {
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === messageId
                  ? { ...m, text: "🚫 Message deleted", isDeleted: true }
                  : m,
              ),
            };
          }
          return c;
        }),
      );
    };

    // ── Handle bulk reassign ──────────────
  const handleConversationsReassigned = (data) => {
  const { conversationIds, newUserId } = data;
  
  // Update assignedTo locally without reload
  setChats((prev) =>
    prev.map((c) =>
      conversationIds.includes(c.id)
        ? { ...c, contact: { ...c.contact, assignedTo: newUserId } }
        : c
    )
  );
};

  const handleUnreadCountUpdate = (data) => {
      const { conversationId, unreadCount } = data;

      const isCurrentChatOpen =
        activeChatId && String(activeChatId) === String(conversationId);

      // If chat is currently OPEN → force count to 0, never show badge
      if (isCurrentChatOpen) {
        setChats((prev) =>
          prev.map((c) =>
            String(c.id) === String(conversationId)
              ? { ...c, unreadCount: 0 }
              : c
          )
        );
        setUnreadMap((prev) => ({ ...prev, [String(conversationId)]: 0 }));
        return;
      }

      // Chat NOT open → update badge normally
      setChats((prev) =>
        prev.map((c) =>
          String(c.id) === String(conversationId)
            ? { ...c, unreadCount: unreadCount }
            : c
        )
      );
    };

  const handleConversationAssigned = (data) => {
     if (data.conversation) {
    setChats((prev) => {
      const exists = prev.some((c) => String(c.id) === String(data.conversation.id));
      if (exists) return prev;
      return [data.conversation, ...prev];  // Add to top
    });
  }
  };

       // ── Handle real-time tick updates (1✓ -> 2✓ -> 2✓ blue) ──
    const handleMessageStatusUpdate = (data) => {
      const { messageId, wamid, status } = data;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId || (wamid && m.wamid === wamid)) {
            return {
              ...m,
              status: status,
              isRead: status === "read" ? true : m.isRead,
            };
          }
          return m;
        })
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("conversations_reassigned", handleConversationsReassigned);
    socket.on("unread_count_update", handleUnreadCountUpdate);
    socket.on("conversation_assigned", handleConversationAssigned);
    socket.on("message_status_update", handleMessageStatusUpdate); // ← ADD THIS

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("conversations_reassigned", handleConversationsReassigned);
      socket.off("unread_count_update", handleUnreadCountUpdate);
      socket.off("conversation_assigned", handleConversationAssigned);
      socket.off("message_status_update", handleMessageStatusUpdate); // ← ADD THIS
    };
  }, [socket, activeChatId, loadConversations]);

  // ── Close conv menu when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target)) {
        setShowConvMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

    // ── Close attach menu when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

    // ── Close emoji picker when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // ── Close sidebar menu when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        sidebarMenuRef.current &&
        !sidebarMenuRef.current.contains(e.target)
      ) {
        setShowSidebarMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Load contacts for new chat modal ──
  useEffect(() => {
    if (showNewChatModal) {
      const loadContacts = async () => {
        setLoadingContacts(true);
        const res = await getContacts(1, 100);
        if (res.success) setAllContacts(res.data.contacts || []);
        setLoadingContacts(false);
      };
      loadContacts();
    }
  }, [showNewChatModal]);

  // ── Load archived when modal opens ──
  useEffect(() => {
    if (showArchived) {
      loadArchivedConversations();
    }
  }, [showArchived]);

  // ── Handle File Select ──
    // ── Handle File Select (works for all media types) ──
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");

    // WhatsApp size limits
    const maxSize = isImage
      ? 5 * 1024 * 1024 // 5MB
      : isVideo || isAudio
        ? 16 * 1024 * 1024 // 16MB
        : 100 * 1024 * 1024; // 100MB for documents

    if (file.size > maxSize) {
      toast.warning(
        `File too large. Max size is ${
          isImage ? "5MB" : isVideo || isAudio ? "16MB" : "100MB"
        }`
      );
      e.target.value = "";
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target.result);
      reader.readAsDataURL(file);
    } else if (isVideo) {
      // Video thumbnail preview using object URL
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }

    e.target.value = ""; // Reset input
  };

  // ── Cancel File ──
  const handleCancelFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileCaption("");
  };

  // ── Send File ──
  const handleSendFile = async () => {
    if (!selectedFile || !activeChatId || !activeChat?.contact?.id) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("conversationId", activeChatId);
      formData.append("caption", fileCaption);

      const res = await sendMediaMessage(activeChat.contact.id, formData);

      if (res.success) {
        handleCancelFile();
        toast.success("File sent successfully!");
      } else {
        toast.error("Failed to send file: " + res.error);
      }
    } catch (err) {
      toast.error("Failed to send file");
    }
    setUploadingFile(false);
  };

  // ── Send Message ──
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChatId || !activeChat?.contact?.id)
      return;

    const messageText = typedMessage;
    const isClosedOrResolved = ["RESOLVED", "CLOSED"].includes(
      activeChat?.status,
    );

    if (isClosedOrResolved) {
      const ok = await confirm({
        type: "info",
        title: "Reopen Conversation?",
        message:
          "This conversation is closed/resolved. Sending will reopen it. Proceed?",
        confirmLabel: "Send & Reopen",
      });
      if (!ok) return;
    }

    setTypedMessage("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    if (socket && activeChatId) {
      socket.emit("agent_typing_stop", { conversationId: activeChatId });
    }

    const res = await sendMessage(activeChat.contact.id, messageText);
    if (res.success) {
      if (isClosedOrResolved) loadConversations();
    } else {
      toast.error("Failed to send message: " + res.message);
    }
  };

  // ── Delete Message ──
  const handleDeleteMessage = async (messageId) => {
    try {
      setDeletingMessageId(messageId);
      const res = await deleteMessage(messageId);

      if (res.success) {
        setDeleteConfirmId(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  text: null,
                  mediaUrl: null,
                  caption: null,
                }
              : m,
          ),
        );
      } else {
        toast.error("Failed to delete: " + res.message);
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error("Delete message error:", err);
      toast.error("Something went wrong while deleting.");
    } finally {
      setDeletingMessageId(null);
    }
  };

  // ── Start New Chat ──
  const handleSelectContactForChat = async (contactId) => {
    const res = await createConversation(contactId);
    if (res.success) {
      setShowNewChatModal(false);
      await loadConversations();
      setActiveChatId(res.data.id);
      setSearchParams({ filter, conversationId: res.data.id });
    } else {
      toast.error("Could not start chat: " + res.message);
    }
  };

  // ── Update Status ──
  const handleUpdateStatus = async (newStatus) => {
    if (!activeChatId) return;
    const actionText = newStatus === "OPEN" ? "reopen" : "resolve";
    const ok = await confirm({
      type: newStatus === "OPEN" ? "info" : "warning",
      title: `${newStatus === "OPEN" ? "Reopen" : "Resolve"} Conversation?`,
      message: `Are you sure you want to ${actionText} this conversation?`,
      confirmLabel: newStatus === "OPEN" ? "Reopen" : "Resolve",
    });
    if (!ok) return;

    const res = await updateConversationStatus(activeChatId, newStatus);
    if (res.success) {
      loadConversations();
      setChats((prev) =>
        prev.map((c) =>
          String(c.id) === String(activeChatId)
            ? { ...c, status: newStatus }
            : c,
        ),
      );
    } else {
      toast.error(res.message);
    }
  };

  // ── Archive Conversation ──
  const handleArchiveConversation = async () => {
    if (!activeChatId) return;

    const ok = await confirm({
      type: "warning",
      title: "Archive Conversation?",
      message: "Archive this conversation? It will be hidden from your inbox.",
      confirmLabel: "Archive",
    });
    if (!ok) return;

    setArchivingConv(true);
    try {
      const res = await archiveConversation(activeChatId);
      if (res.success) {
        setChats((prev) =>
          prev.filter((c) => String(c.id) !== String(activeChatId)),
        );
        setActiveChatId(null);
        setSearchParams({ filter });
        setShowConvMenu(false);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to archive conversation");
    }
    setArchivingConv(false);
  };

  // ── Delete Conversation ──
  const handleDeleteConversation = async () => {
    if (!activeChatId) return;

    setDeletingConv(true);
    try {
      const res = await deleteConversation(activeChatId);
      if (res.success) {
        setChats((prev) =>
          prev.filter((c) => String(c.id) !== String(activeChatId)),
        );
        setActiveChatId(null);
        setSearchParams({ filter });
        setShowDeleteConfirm(false);
        setShowConvMenu(false);
        toast.success("Conversation deleted successfully.");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to delete conversation");
    }
    setDeletingConv(false);
  };

  // ── Assign Tag ──
  const handleAssignTag = async () => {
    if (!selectedTag || !activeChat?.contact?.id) return;
    setAssigningTag(true);
    try {
      const res = await addTagToContact(activeChat.contact.id, selectedTag);
      if (res.success) {
        setChats((prev) =>
          prev.map((c) => {
            if (String(c.id) === String(activeChatId)) {
              const tagObj = allTags.find((t) => t.id === selectedTag);
              const alreadyHas = (c.contact?.contactTags || []).some(
                (ct) => ct.tag?.id === selectedTag,
              );
              if (alreadyHas || !tagObj) return c;
              return {
                ...c,
                contact: {
                  ...c.contact,
                  contactTags: [
                    ...(c.contact?.contactTags || []),
                    { tag: tagObj },
                  ],
                },
              };
            }
            return c;
          }),
        );
        setSelectedTag("");
        toast.success("Tag added successfully!");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to assign tag");
    }
    setAssigningTag(false);
  };

  // ── Remove Tag ──
  const handleRemoveTag = async (tagId) => {
    if (!activeChat?.contact?.id) return;
    try {
      const res = await removeTagFromContact(activeChat.contact.id, tagId);
      if (res.success) {
        setChats((prev) =>
          prev.map((c) => {
            if (String(c.id) === String(activeChatId)) {
              return {
                ...c,
                contact: {
                  ...c.contact,
                  contactTags: (c.contact?.contactTags || []).filter(
                    (ct) => ct.tag?.id !== tagId,
                  ),
                },
              };
            }
            return c;
          }),
        );
        toast.success("Tag removed successfully!");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to remove tag");
    }
  };

  // ── Assign Agent ──
  const handleAssignAgent = async () => {
    if (!selectedAgent || !activeChat?.contact?.id) return;
    setAssigningUser(true);
    try {
      const res = await assignContact(activeChat.contact.id, selectedAgent);
      if (res.success) {
        setChats((prev) =>
          prev.map((c) => {
            if (String(c.id) === String(activeChatId)) {
              return {
                ...c,
                contact: {
                  ...c.contact,
                  assignedTo: selectedAgent,
                },
              };
            }
            return c;
          }),
        );
        setSelectedAgent("");
        toast.success("Agent assigned successfully!");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error("Assign agent error:", err);
      toast.error("Failed to assign agent");
    }
    setAssigningUser(false);
  };

  // ── Avatar & Tag Colors ──
  const getAvatarStyle = (name) => {
    const chars = name ? name.charCodeAt(0) : 0;
    const colors = [
      "bg-emerald-100 text-emerald-800",
      "bg-teal-100 text-teal-800",
      "bg-green-100 text-green-800",
      "bg-lime-100 text-lime-800",
      "bg-cyan-100 text-cyan-800",
    ];
    return colors[chars % colors.length];
  };

  const getTagColor = (tag) => {
    if (tag === "Enterprise")
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (tag === "Interested in pricing")
      return "bg-teal-50 text-teal-700 border-teal-200";
    if (tag === "VIP") return "bg-green-50 text-green-800 border-green-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  // ── Can Delete Message ──
  const canDeleteMessage = (msg) => {
    if (msg.isDeleted) return false;
    if (user?.type === "TENANT") return true;
    if (user?.type === "USER") {
      if (msg.isFromCustomer) return false;
      return msg.senderId === user?.id;
    }
    return false;
  };

  // ── Start Audio Recording ──
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await sendVoiceMessage(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Could not access microphone. Please allow mic permission.");
    }
  };

  // ── Stop Recording ──
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // ── Cancel Recording ──
  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  };


    // ── Handle Emoji Select ──
  const handleEmojiClick = (emojiData) => {
    setTypedMessage((prev) => prev + emojiData.emoji);
  };

  // ── Handle Attach Menu Item Click ──
  const handleAttachMenuClick = (type) => {
    setShowAttachMenu(false);

    switch (type) {
      case "document":
        documentInputRef.current?.click();
        break;
      case "photos":
        photoVideoInputRef.current?.click();
        break;
      case "camera":
        cameraInputRef.current?.click();
        break;
      case "audio":
        audioInputRef.current?.click();
        break;
      case "contact":
        setShowContactPickerModal(true);
        break;
      case "location":
        setShowLocationModal(true);
        break;
      default:
        break;
    }
  };

  // ── Handle Contact Share ──
  const handleShareContacts = async () => {
    if (selectedContactsToShare.length === 0) {
      toast.warning("Please select at least one contact to share");
      return;
    }
    if (!activeChat?.contact?.phone) {
      toast.error("Contact phone number not found");
      return;
    }

    setSendingContact(true);
    try {
      const to = activeChat.contact.phone.replace(/^\+/, "");
      const contactsToSend = selectedContactsToShare.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email || undefined,
      }));

      const res = await api.post(
        `${import.meta.env.VITE_BACKEND_URL}/api5/send-contact`,
        {
          to,
          contacts: contactsToSend,
          conversationId: activeChatId,
        }
      );

      if (res.data?.success) {
        setShowContactPickerModal(false);
        setSelectedContactsToShare([]);
        setContactPickerSearch("");
        toast.success(
          `${contactsToSend.length} contact(s) shared successfully!`
        );
      } else {
        toast.error(res.data?.message || "Failed to share contact");
      }
    } catch (err) {
      console.error("Share contact error:", err);
      toast.error(
        err.response?.data?.message || "Failed to share contact"
      );
    }
    setSendingContact(false);
  };

  // ── Toggle Contact Selection ──
  const toggleContactSelection = (contact) => {
    setSelectedContactsToShare((prev) => {
      const exists = prev.some((c) => c.id === contact.id);
      if (exists) return prev.filter((c) => c.id !== contact.id);
      return [...prev, contact];
    });
  };


    // ── Send Location ──
  const handleSendLocation = async () => {
    setLocationError("");

    const lat = parseFloat(locationForm.latitude);
    const lng = parseFloat(locationForm.longitude);

    if (!locationForm.latitude || !locationForm.longitude) {
      setLocationError("Latitude and longitude are required");
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setLocationError("Latitude must be between -90 and 90");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setLocationError("Longitude must be between -180 and 180");
      return;
    }
    if (!activeChat?.contact?.phone) {
      setLocationError("Contact phone number not found");
      return;
    }

    setSendingLocation(true);
    try {
      const to = activeChat.contact.phone.replace(/^\+/, "");

      const res = await sendLocation({
        to,
        latitude:       lat,
        longitude:      lng,
        name:           locationForm.name    || undefined,
        address:        locationForm.address || undefined,
        conversationId: activeChatId,
      });

      if (res.success) {
        setShowLocationModal(false);
        setShowAttachMenu(false);
        setLocationForm({ name: "", address: "", latitude: "", longitude: "" });
        toast.success("Location sent!");
      } else {
        setLocationError(res.message || "Failed to send location");
      }
    } catch (err) {
      setLocationError("Something went wrong");
    }
    setSendingLocation(false);
  };


  // ── Send Voice Message ──
  const sendVoiceMessage = async (audioBlob) => {
    if (!activeChatId || !activeChat?.contact?.id) return;
    if (audioBlob.size === 0) return;

    try {
      const fileName = `voice_${Date.now()}.webm`;
      const file = new File([audioBlob], fileName, { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", activeChatId);
      formData.append("caption", "");

      const res = await sendMediaMessage(activeChat.contact.id, formData);
      if (!res.success) {
        toast.error("Failed to send voice: " + res.error);
      }
    } catch (err) {
      console.error("Voice send error:", err);
      toast.error("Failed to send voice message");
    }
  };

  // ── Load Archived Conversations ──
  const loadArchivedConversations = async () => {
    setLoadingArchived(true);
    const res = await getArchivedConversations(1, 50);
    if (res.success) {
      const list =
        res.data?.conversations || res.data?.data?.conversations || [];
      setArchivedChats(list);
    }
    setLoadingArchived(false);
  };

  // ─────────────────────────────────────────────
  // ── BULK REASSIGN HANDLERS ── ADD FROM HERE ──
  // ─────────────────────────────────────────────

  // ── Toggle Bulk Select Mode ──
  const handleToggleBulkSelectMode = () => {
    setBulkSelectMode((prev) => !prev);
    setSelectedConvIds([]);
  };

  // ── Toggle Single Conversation Selection ──
  const handleToggleConvSelection = (convId) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId)
        ? prev.filter((id) => id !== convId)
        : [...prev, convId],
    );
  };

  // ── Select All Conversations ──
  const handleSelectAll = () => {
    if (selectedConvIds.length === tabFilteredChats.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(tabFilteredChats.map((c) => c.id));
    }
  };

  // ── Bulk Reassign Submit ──
  const handleBulkReassign = async () => {
    if (selectedConvIds.length === 0) {
      toast.warning("Please select at least one conversation");
      return;
    }

    const newUserId = bulkTargetUserId || null;

    const targetUserName = newUserId
      ? allAgents.find((a) => a.id === newUserId)?.name || "selected user"
      : "no one (unassign)";

    const ok = await confirm({
      type: "warning",
      title: "Bulk Reassign Conversations?",
      message: `Reassign ${selectedConvIds.length} conversation(s) to ${targetUserName}?`,
      confirmLabel: "Reassign",
    });

    if (!ok) return;

    setBulkReassigning(true);
    try {
      const res = await bulkReassignConversations(selectedConvIds, newUserId);

      if (res.success) {
        toast.success(
          res.message || `${selectedConvIds.length} conversation(s) reassigned`,
        );

        // ── Update local state immediately ──
        setChats((prev) =>
          prev.map((c) => {
            if (selectedConvIds.includes(c.id)) {
              return {
                ...c,
                contact: {
                  ...c.contact,
                  assignedTo: newUserId,
                },
              };
            }
            return c;
          }),
        );

        // ── Reset bulk mode ──
        setSelectedConvIds([]);
        setBulkSelectMode(false);
        setShowBulkReassignModal(false);
        setBulkTargetUserId("");
      } else {
        toast.error(res.message || "Failed to reassign conversations");
      }
    } catch (err) {
      toast.error("Something went wrong during bulk reassign");
    }
    setBulkReassigning(false);
  };

  // ── Delete All Chats (Admin Only) ──
  const handleDeleteAllChats = async () => {
    if (userRole !== "admin") return;

    setDeletingAllChats(true);
    try {
      for (const chat of chats) {
        await deleteConversation(chat.id);
      }
      toast.success(`${chats.length} chat(s) deleted successfully`);
      setChats([]);
      setActiveChatId(null);
      setSearchParams({ filter });
      setShowDeleteAllConfirm(false);
      setShowSidebarMenu(false);
    } catch (err) {
      toast.error("Failed to delete all chats");
    }
    setDeletingAllChats(false);
  };

  // ─────────────────────────────────────────────
  // ── BULK REASSIGN HANDLERS END ───────────────
  // ─────────────────────────────────────────────
  // ── Unarchive Handler ──
  const handleUnarchiveConversation = async (conversationId) => {
    setUnarchivingId(conversationId);
    try {
      const res = await unarchiveConversation(conversationId);
      if (res.success) {
        setArchivedChats((prev) =>
          prev.filter((c) => String(c.id) !== String(conversationId)),
        );
        await loadConversations();
        toast.success("Conversation unarchived.");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to unarchive conversation");
    }
    setUnarchivingId(null);
  };

  // ── Filters ──
  const filteredChats = chats.filter((c) => {
    const name = c.contact?.name || "";
    const phone = c.contact?.phone || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery)
    );
  });

  const tabCounts = {
    all: chats.length,
    unread: chats.filter((c) => c.status === "OPEN" && getUnreadCount(c.id) > 0)
      .length,
    open: chats.filter((c) => c.status === "OPEN").length,
    closed: chats.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED",
    ).length,
  };

  // FIXED: This is the single source of truth for inbox_unread_count
  // TopNavBar will check data-inbox-mounted before double counting
  useEffect(() => {
    localStorage.setItem("inbox_unread_count", String(tabCounts.unread));
    window.dispatchEvent(new Event("unread_updated"));
  }, [tabCounts.unread]);

  const tabFilteredChats = filteredChats.filter((c) => {
    switch (activeTab) {
      case "unread":
        return c.status === "OPEN" && getUnreadCount(c.id) > 0;
      case "open":
        return c.status === "OPEN";
      case "closed":
        return c.status === "RESOLVED" || c.status === "CLOSED";
      default:
        return true;
    }
  });

  const handleTabClick = (tabValue) => {
    const params = { filter };
    if (tabValue !== "all") params.tab = tabValue;
    if (activeChatId) params.conversationId = activeChatId;
    setSearchParams(params);
  };

  const inboxTabs = [
    { label: "All", value: "all", count: tabCounts.all },
    { label: "Unread", value: "unread", count: tabCounts.unread },
    { label: "Open", value: "open", count: tabCounts.open },
    { label: "Closed", value: "closed", count: tabCounts.closed },
  ];

  const filteredContacts = allContacts.filter((c) => {
    const name = c.name || "";
    const phone = c.phone || "";
    return (
      name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      phone.includes(modalSearch)
    );
  });

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    // FIXED: Added data-inbox-mounted marker so TopNavBar knows Inbox is active
    // and won't double-increment the inbox_unread_count
    <div
      data-inbox-mounted="true"
      className="h-[calc(100vh-130px)] flex rounded-3xl overflow-hidden animate-in fade-in duration-200 border border-[#075E54]/10 shadow-lg shadow-[#075E54]/5"
    >
      {/* ══════════════════════════════════════
    LEFT SIDEBAR
══════════════════════════════════════ */}
      <div className="w-80 flex flex-col shrink-0 bg-white border-r border-emerald-100">
        {/* Header */}
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-tl-3xl">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm shrink-0">
              <FaWhatsapp className="w-4.5 h-4.5 text-white" />
            </span>
            <div>
              <span className="text-sm font-bold text-white tracking-wide">
                WhatsApp
              </span>
              <p className="text-[10px] text-emerald-200 font-medium">
                Business Inbox
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* ── New Chat Button ── */}
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-semibold rounded-lg transition duration-150 border border-white/10 shrink-0"
            >
              <MessageSquarePlus size={13} />
              <span>New Chat</span>
            </button>

            {/* ── 3-Dot Menu (Admin Only) ── */}
            {userRole === "admin" && (
              <div className="relative" ref={sidebarMenuRef}>
                <button
                  onClick={() => setShowSidebarMenu((prev) => !prev)}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                  title="More options"
                >
                  <MoreVertical size={18} />
                </button>

                {showSidebarMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-emerald-100 overflow-hidden w-52">
                    {/* Bulk Reassign */}
                    <button
                      onClick={() => {
                        setBulkSelectMode(true);
                        setShowSidebarMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#111B21] hover:bg-[#F0F2F5] transition"
                    >
                      <UserCheck size={14} className="text-[#075E54]" />
                      <span>Bulk Reassign</span>
                    </button>

                    {/* Delete All Chats */}
                    <div className="h-px bg-[#F0F2F5]" />
                    <button
                      onClick={() => {
                        setShowSidebarMenu(false);
                        setShowDeleteAllConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                      <span>Delete All Chats</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 bg-[#F0F2F5]">
          <div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-[#54656F]"
              size={14}
            />
            <input
              type="text"
              placeholder="Search or start new chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white rounded-lg border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-2 bg-white border-b border-emerald-100 flex items-center overflow-x-auto scrollbar-none">
          {inboxTabs.map((tab) => {
            const isTabActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition duration-150 shrink-0 ${
                  isTabActive
                    ? "border-[#25D366] text-[#075E54]"
                    : "border-transparent text-[#667781] hover:text-[#111B21] hover:border-emerald-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-full text-[9px] font-bold leading-none ${
                    isTabActive
                      ? "bg-[#25D366]/15 text-[#075E54]"
                      : tab.value === "unread" && tab.count > 0
                        ? "bg-[#25D366] text-white"
                        : "bg-[#F0F2F5] text-[#667781]"
                  }`}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bulk Action Bar */}
        {bulkSelectMode && userRole === "admin" && (
          <div className="px-3 py-2 bg-[#075E54]/10 border-b border-emerald-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  selectedConvIds.length === tabFilteredChats.length &&
                  tabFilteredChats.length > 0
                }
                onChange={handleSelectAll}
                className="w-3.5 h-3.5 accent-[#075E54] cursor-pointer"
              />
              <span className="text-[10px] font-semibold text-[#075E54]">
                {selectedConvIds.length > 0
                  ? `${selectedConvIds.length} selected`
                  : "Select all"}
              </span>
            </div>
            <button
              onClick={() => setShowBulkReassignModal(true)}
              disabled={selectedConvIds.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#075E54] hover:bg-[#064E47] text-white text-[10px] font-bold rounded-lg transition disabled:opacity-40"
            >
              <UserCheck size={12} />
              <span>Reassign ({selectedConvIds.length})</span>
            </button>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-4 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-[#667781]">
                <RefreshCw size={14} className="animate-spin text-[#25D366]" />
                Loading chats...
              </div>
            </div>
          ) : (
            tabFilteredChats.map((chat, chatIdx) => {
              const contactName = chat.contact?.name || "Unknown Contact";
              const lastMsg = chat.messages?.[0];
              const isActive = String(chat.id) === String(activeChatId);
              const avatarBg = getAvatarStyle(contactName);
              const unreadCount = getUnreadCount(chat.id);
              const timeStr = lastMsg ? formatTime(lastMsg.createdAt) : "";

              return (
                <div
                  key={chat.id || `chat-${chatIdx}`}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-[#F0F2F5] transition ${
                    isActive ? "bg-[#F0F2F5]" : "hover:bg-[#F5F6F6] bg-white"
                  } ${
                    bulkSelectMode && selectedConvIds.includes(chat.id)
                      ? "bg-emerald-50 border-l-2 border-l-[#25D366]"
                      : ""
                  }`}
                >
                  {bulkSelectMode && userRole === "admin" && (
                    <div className="flex items-center justify-center pt-3 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedConvIds.includes(chat.id)}
                        onChange={() => handleToggleConvSelection(chat.id)}
                        className="w-4 h-4 accent-[#075E54] cursor-pointer"
                      />
                    </div>
                  )}

                  <button
                    className="flex-1 text-left flex items-start gap-3"
                    onClick={() => {
                      if (bulkSelectMode) handleToggleConvSelection(chat.id);
                      else {
                        setActiveChatId(chat.id);
                        setSearchParams({ filter, conversationId: chat.id });
                      }
                    }}
                  >
                                      <div className="relative shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${avatarBg}`}
                      >
                        {contactName.charAt(0)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm truncate max-w-[180px] ${
                            unreadCount > 0
                              ? "font-bold text-[#111B21]"
                              : "font-semibold text-[#111B21]"
                          }`}
                        >
                          {contactName}
                        </span>
                        <span
                          className={`text-[10px] ${
                            unreadCount > 0
                              ? "text-[#25D366] font-semibold"
                              : "text-[#667781]"
                          }`}
                        >
                          {timeStr}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p
                          className={`text-xs truncate max-w-[200px] ${
                            unreadCount > 0
                              ? "text-[#111B21] font-medium"
                              : "text-[#667781]"
                          }`}
                        >
                          {formatLastMessagePreview(lastMsg)}
                        </p>

                        {unreadCount > 0 && (
                          <span className="ml-2 bg-[#25D366] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}

          {!loading && tabFilteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-3">
                <FaWhatsapp className="w-7 h-7 text-[#25D366]" />
              </div>
              <p className="text-sm font-medium text-[#667781]">
                No chats found
              </p>
            </div>
          )}
        </div>

        {/* Archived Button */}
        <div className="px-3 py-2 border-t border-emerald-100 shrink-0">
          <button
            onClick={() => setShowArchived(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#667781] hover:text-[#075E54] hover:bg-[#F0F2F5] rounded-xl transition duration-150"
          >
            <span>📁 Archived Chats</span>
            {archivedChats.length > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#075E54] text-white text-[9px] font-bold">
                {archivedChats.length}
              </span>
            )}
          </button>
        </div>
      </div>
      {/* ══ End Left Sidebar ══ */}

      {/* ══════════════════════════════════════
          MIDDLE CHAT AREA
      ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-[#075E54] px-5 py-3 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-white/20 ${getAvatarStyle(
                    activeChat.contact?.name,
                  )}`}
                >
                  {(activeChat.contact?.name || "C").charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-none">
                    {activeChat.contact?.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeChat.status === "OPEN"
                          ? "bg-[#25D366]"
                          : "bg-[#667781]"
                      }`}
                    />
                    <p className="text-[10px] text-emerald-200 font-medium">
                      {activeChat.contact?.phone} ·{" "}
                      {activeChat.status === "OPEN" ? "Online" : "Offline"}
                    </p>
                    {activeViewers.filter((v) => String(v.userId) !== String(user?.id)).length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#064E47] text-emerald-100 text-[10px] font-medium border border-emerald-400/30 ml-2 shadow-sm">
                        <Eye size={11} className="text-emerald-300" />
                        <span>
                          {activeViewers
                            .filter((v) => String(v.userId) !== String(user?.id))
                            .map((v) => v.name)
                            .join(", ")}{" "}
                          viewing
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>


              
              <div className="flex items-center gap-2">

                {activeChat.status === "OPEN" ? (
                  <button
                    onClick={() => handleUpdateStatus("RESOLVED")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/10 rounded-xl text-white text-xs font-semibold transition duration-150"
                    title="Mark as Resolved"
                  >
                    <CheckCircle2 size={13} />
                    <span>Resolve</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus("OPEN")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#22C55E] border border-[#25D366] rounded-xl text-white text-xs font-semibold transition duration-150"
                    title="Reopen conversation"
                  >
                    <RefreshCw size={13} />
                    <span>Reopen</span>
                  </button>
                )}

                {/* Conv Menu */}
                <div className="relative" ref={convMenuRef}>
                  <button
                    onClick={() => setShowConvMenu((prev) => !prev)}
                    className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showConvMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-emerald-100 overflow-hidden w-44">
                      <button
                        onClick={handleArchiveConversation}
                        disabled={archivingConv}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#111B21] hover:bg-[#F0F2F5] transition disabled:opacity-50"
                      >
                        {archivingConv ? (
                          <RefreshCw
                            size={14}
                            className="animate-spin text-[#075E54]"
                          />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#075E54"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                        )}
                        <span>Archive Chat</span>
                      </button>

                      {userRole === "admin" && (
                        <>
                          <div className="h-px bg-[#F0F2F5]" />
                          <button
                            onClick={() => {
                              setShowConvMenu(false);
                              setShowDeleteConfirm(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
                          >
                            <Trash2 size={14} />
                            <span>Delete Chat</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                   {/* ⭐ NEW: Details Toggle Button ⭐ */}
                <button
                  onClick={() => setShowContactPanel((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/10 rounded-xl text-white text-xs font-semibold transition duration-150"
                  title={showContactPanel ? "Hide contact details" : "Show contact details"}
                >
                  <span>Details</span>
                  {showContactPanel ? (
                    <ChevronRight size={13} />
                  ) : (
                    <ChevronLeft size={13} />
                  )}
                </button>


              </div>




            </div>

            {/* Collision Warning Alert Banner */}
            {typingAgents.filter((t) => String(t.userId) !== String(user?.id)).length > 0 && (
              <div className="bg-amber-500 text-white px-5 py-2.5 flex items-center justify-between shadow-md animate-pulse shrink-0 border-b border-amber-600">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <AlertTriangle size={16} className="text-amber-100 shrink-0" />
                  <span>
                    ⚠️ COLLISION ALERT:{" "}
                    {typingAgents
                      .filter((t) => String(t.userId) !== String(user?.id))
                      .map((t) => t.name)
                      .join(", ")}{" "}
                    is currently typing a reply to this customer!
                  </span>
                </div>
                <span className="text-[9px] bg-black/20 text-white px-2 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
                  Live
                </span>
              </div>
            )}

            {/* Delete Conversation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-red-100 shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="px-6 py-4 bg-red-500 flex items-center gap-2.5 rounded-t-3xl">
                    <Trash2 size={16} className="text-white" />
                    <h2 className="text-base font-bold text-white">
                      Delete Conversation
                    </h2>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-[#111B21] font-medium mb-1">
                      Are you sure you want to delete this conversation?
                    </p>
                    <p className="text-xs text-[#667781] mb-6">
                      ⚠️ This will permanently delete all messages and cannot be
                      undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deletingConv}
                        className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteConversation}
                        disabled={deletingConv}
                        className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {deletingConv ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div
              className="flex-1 p-6 overflow-y-auto space-y-3"
              style={{
                backgroundColor: "#ECE5DD",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23075E54' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {messages.length > 0 && (
                <div className="flex items-center justify-center mb-2">
                  <span className="px-4 py-1 bg-white/80 backdrop-blur-sm rounded-lg text-[10px] font-semibold text-[#54656F] shadow-sm">
                    {formatDate(messages[0]?.createdAt)}
                  </span>
                </div>
              )}

              {messages.map((msg) => {
                const isAgent = !msg.isFromCustomer;
                const timeStr = formatTime(msg.createdAt);

                const BACKEND_URL =
                  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

                const getMediaUrl = (mediaUrl) => {
                  if (!mediaUrl) return "";
                  
                  let cleaned = mediaUrl;
                  if (cleaned.startsWith("undefined/")) {
                    cleaned = cleaned.replace("undefined/", "");
                  }
                  if (cleaned.includes("localhost") || cleaned.includes("backend:5000")) {
                    cleaned = cleaned.replace(/^https?:\/\/[^\/]+/, "").replace(/^\/+/, "");
                  }

                  if (
                    cleaned.startsWith("http://") ||
                    cleaned.startsWith("https://")
                  ) {
                    return cleaned;
                  }

                  const cleanPath = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
                  return `${BACKEND_URL.replace(/\/+$/, '')}${cleanPath}`;
                };

                // ── DELETED MESSAGE UI ──
                if (msg.isDeleted) {
                  return (
                    <div
                      key={msg.id || `msg-del-${msgIdx}`}
                      className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm text-[13px] relative opacity-60 ${
                          isAgent
                            ? "bg-[#D9FDD3] text-[#111B21] rounded-tr-none"
                            : "bg-white text-[#111B21] rounded-tl-none"
                        }`}
                      >
                        <p className="italic text-[#667781] text-xs flex items-center gap-1">
                          🚫 This message was deleted
                        </p>
                        <div className="mt-1 flex justify-end">
                          <span className="text-[10px] text-[#667781]">
                            {timeStr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── NORMAL MESSAGE UI ──
                return (
                  <div
                    key={msg.id || `msg-${msgIdx}`}
                    className={`flex ${isAgent ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    {/* Delete Button (left of agent msg) */}
                    {isAgent &&
                      hoveredMessageId === msg.id &&
                      canDeleteMessage(msg) && (
                        <div className="flex items-center mr-1 relative">
                          <button
                            onClick={() =>
                              setDeleteConfirmId(
                                deleteConfirmId === msg.id ? null : msg.id,
                              )
                            }
                            className="p-1.5 rounded-full bg-white/80 hover:bg-red-50 text-[#667781] hover:text-red-500 shadow-sm transition duration-150"
                            title="Delete message"
                          >
                            <Trash2 size={13} />
                          </button>

                          {deleteConfirmId === msg.id && (
                            <div className="absolute bottom-full right-0 mb-1 z-50 bg-white rounded-xl shadow-xl border border-red-100 p-3 w-44">
                              <p className="text-[11px] font-semibold text-[#111B21] mb-2 text-center">
                                Delete this message?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  disabled={deletingMessageId === msg.id}
                                  className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  disabled={deletingMessageId === msg.id}
                                  className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  {deletingMessageId === msg.id ? (
                                    <RefreshCw
                                      size={10}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    "Delete"
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm text-[13px] relative ${
                        isAgent
                          ? "bg-[#D9FDD3] text-[#111B21] rounded-tr-none"
                          : "bg-white text-[#111B21] rounded-tl-none"
                      }`}
                    >
                      {!isAgent && (
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowDownLeft size={10} className="text-[#25D366]" />
                          <span className="text-[9px] font-bold text-[#075E54]">
                            {activeChat.contact?.name?.split(" ")[0]}
                          </span>
                        </div>
                      )}

                      {/* Delete Button for INBOUND (right side, admin only) */}
                      {!isAgent &&
                        hoveredMessageId === msg.id &&
                        canDeleteMessage(msg) && (
                          <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                            <button
                              onClick={() =>
                                setDeleteConfirmId(
                                  deleteConfirmId === msg.id ? null : msg.id,
                                )
                              }
                              className="p-1.5 rounded-full bg-white/80 hover:bg-red-50 text-[#667781] hover:text-red-500 shadow-sm transition duration-150"
                              title="Delete message"
                            >
                              <Trash2 size={13} />
                            </button>

                            {deleteConfirmId === msg.id && (
                              <div className="absolute bottom-full left-0 mb-1 z-50 bg-white rounded-xl shadow-xl border border-red-100 p-3 w-44">
                                <p className="text-[11px] font-semibold text-[#111B21] mb-2 text-center">
                                  Delete this message?
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={deletingMessageId === msg.id}
                                    className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    disabled={deletingMessageId === msg.id}
                                    className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                  >
                                    {deletingMessageId === msg.id ? (
                                      <RefreshCw
                                        size={10}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      "Delete"
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* TEXT / INTERACTIVE BODY */}
                      {(msg.type === "TEXT" || msg.type === "INTERACTIVE_BUTTONS" || (!msg.type && msg.text)) && (
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}



                      {/* IMAGE */}
                      {msg.type === "IMAGE" && msg.mediaUrl && (
                        <div className="mb-1">
                          <div
                            onClick={() =>
                              setPreviewImageModal({
                                type: "IMAGE",
                                url: getMediaUrl(msg.mediaUrl),
                                name: msg.mediaName,
                                caption: msg.caption,
                              })
                            }
                            className="block relative group cursor-pointer"
                            title="Click to preview image"
                          >
                            <img
                              src={getMediaUrl(msg.mediaUrl)}
                              alt={msg.mediaName || "image"}
                              className="rounded-lg max-w-full hover:opacity-90 transition shadow-sm"
                              style={{
                                maxWidth: "220px",
                                maxHeight: "200px",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                          {msg.caption && (
                            <p className="text-xs mt-1 text-[#111B21]">
                              {msg.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {/* FILE */}
                      {msg.type === "FILE" && msg.mediaUrl && (
                        <div
                          onClick={() =>
                            setPreviewImageModal({
                              type: "FILE",
                              url: getMediaUrl(msg.mediaUrl),
                              name: msg.mediaName,
                              caption: msg.caption,
                            })
                          }
                          className="flex items-center gap-2 p-2 bg-white/60 hover:bg-white/90 rounded-lg mb-1 min-w-[180px] transition cursor-pointer group shadow-sm"
                          title="Click to preview/view file"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#075E54]/10 flex items-center justify-center shrink-0">
                            <Paperclip size={16} className="text-[#075E54]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#111B21] truncate group-hover:text-[#075E54] transition">
                              {msg.mediaName || "File"}
                            </p>
                            <p className="text-[9px] text-[#667781]">
                              {msg.mediaSize
                                ? msg.mediaSize < 1024 * 1024
                                  ? (msg.mediaSize / 1024).toFixed(1) + " KB"
                                  : (msg.mediaSize / (1024 * 1024)).toFixed(1) +
                                    " MB"
                                : ""}
                            </p>
                            {msg.caption && (
                              <p className="text-[10px] text-[#111B21] mt-0.5">
                                {msg.caption}
                              </p>
                            )}
                          </div>
                          <div className="text-[#075E54] hover:text-[#064E47] transition shrink-0 p-1">
                            <Eye size={16} />
                          </div>
                        </div>
                      )}

                      {/* VIDEO */}
                      {msg.type === "VIDEO" && msg.mediaUrl && (
                        <div className="mb-1">
                          <div
                            onClick={() =>
                              setPreviewImageModal({
                                type: "VIDEO",
                                url: getMediaUrl(msg.mediaUrl),
                                name: msg.mediaName,
                                caption: msg.caption,
                              })
                            }
                            className="relative group cursor-pointer"
                            title="Click for full-screen video player"
                          >
                            <video
                              src={getMediaUrl(msg.mediaUrl)}
                              controls
                              className="rounded-lg"
                              style={{ maxWidth: "220px" }}
                            />
                          </div>
                          {msg.caption && (
                            <p className="text-xs mt-1 text-[#111B21]">
                              {msg.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {/* AUDIO */}
                      {msg.type === "AUDIO" && msg.mediaUrl && (
                        <div className="mb-1">
                          <audio
                            src={getMediaUrl(msg.mediaUrl)}
                            controls
                            style={{ maxWidth: "220px" }}
                          />
                        </div>
                      )}

                      {/* ORDER (WhatsApp Cart / Commerce) */}
                      {msg.type === "ORDER" && (
                        <div className="mb-1">
                          <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 rounded-xl p-3 min-w-[240px] max-w-[280px] shadow-xs">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/60">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                  <ShoppingBag size={13} />
                                </div>
                                <span className="text-xs font-bold text-emerald-900">
                                  WhatsApp Order
                                </span>
                              </div>
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-200/60 text-emerald-800 tracking-wider">
                                Received
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* CATALOG (WhatsApp Catalog Message) */}
                      {msg.type === "CATALOG" && (
                        <div className="mb-1">
                          <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/70 border border-indigo-200/80 rounded-xl p-3 min-w-[220px] max-w-[260px] shadow-xs">
                            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-indigo-200/60">
                              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <ShoppingBag size={13} />
                              </div>
                              <span className="text-xs font-bold text-indigo-900">
                                Product Catalog
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 leading-relaxed mb-2.5">
                              {msg.text || "Browse our product catalog"}
                            </p>

                            <div className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-bold text-center flex items-center justify-center gap-1.5 shadow-xs">
                              <ShoppingBag size={12} />
                              <span>View Catalog</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* LOCATION */}
                      {msg.type === "LOCATION" && (() => {
                        let lat = msg.locLatitude ? Number(msg.locLatitude) : null;
                        let lng = msg.locLongitude ? Number(msg.locLongitude) : null;

                        if ((!lat || !lng) && msg.text) {
                          const match = msg.text.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
                          if (match) {
                            lat = Number(match[1]);
                            lng = Number(match[2]);
                          }
                        }

                        return (
                          <div className="my-1.5 w-full min-w-[260px] max-w-[320px] rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md">
                            {/* Map Preview Header */}
                            <div className="relative h-28 bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-200/70">
                              {/* Stylized Google Maps Background Grid */}
                              <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/10" />

                              {/* Stylized Road Lines Simulation */}
                              <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                                <path d="M-20,40 Q80,10 160,50 T340,70" fill="none" stroke="#64748b" strokeWidth="6" />
                                <path d="M40,-10 Q90,60 180,90 T300,140" fill="none" stroke="#cbd5e1" strokeWidth="4" />
                                <path d="M120,-10 L140,120" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 4" />
                              </svg>

                              {/* Center Static Map Pin */}
                              <div className="relative z-10 flex flex-col items-center drop-shadow-md">
                                <div className="w-9 h-9 rounded-full bg-[#EA4335] text-white flex items-center justify-center border-2 border-white shadow-sm">
                                  <MapPin size={18} className="fill-white" />
                                </div>
                                <div className="w-2 h-1 rounded-full bg-slate-900/40 mt-0.5" />
                              </div>

                              {/* Top Badges */}
                              <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between z-10">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/75 backdrop-blur-md text-[10px] font-bold text-white shadow-sm">
                                  <MapPin size={10} className="text-emerald-400" />
                                  {msg.senderType === "CONTACT" ? "Customer Location" : "Store Location"}
                                </span>
                                {lat && lng && (
                                  <span className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[9px] font-mono font-bold text-slate-700 shadow-sm">
                                    {lat.toFixed(3)}, {lng.toFixed(3)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Location Details Body */}
                            <div className="p-3 bg-white space-y-2.5">
                              <div>
                                <p className="text-xs font-bold text-slate-900 leading-tight">
                                  {msg.locName || (msg.senderType === "CONTACT" ? "📍 Shared Delivery Location" : "🏬 Store Location Pin")}
                                </p>
                                {msg.locAddress && (
                                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                                    {msg.locAddress}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons */}
                              {lat && lng && (
                                <div className="pt-1 flex items-center gap-2">
                                  <a
                                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition active:scale-[0.98]"
                                  >
                                    <ExternalLink size={13} />
                                    <span>Open in Google Maps</span>
                                  </a>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard?.writeText(`${lat}, ${lng}`);
                                    }}
                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                                    title="Copy Coordinates"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {/* ⭐ BUTTONS (Interactive / Template buttons) */}
                      {(() => {
                        let btns = null;
                        if (Array.isArray(msg.buttons)) {
                          btns = msg.buttons;
                        } else if (typeof msg.buttons === "string") {
                          try {
                            btns = JSON.parse(msg.buttons);
                          } catch (e) {
                            btns = null;
                          }
                        }
                        if (!btns || !Array.isArray(btns) || btns.length === 0) return null;

                        return (
                          <div className="mt-2.5 pt-2 border-t border-[#075E54]/10 space-y-1.5">
                            {btns.map((btn, i) => {
                              const title = btn.title || btn.text || `Button ${i + 1}`;
                              const type = (btn.type || "").toUpperCase();
                              const url = btn.url || btn.url_link;
                              const phone = btn.phoneNumber || btn.phone_number;

                              if (type === "URL" && url) {
                                return (
                                  <a
                                    key={btn.id || i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/70 hover:bg-white border border-[#075E54]/20 rounded-lg text-[12px] font-semibold text-[#075E54] hover:text-[#064E47] transition shadow-xs"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                      <polyline points="15 3 21 3 21 9"/>
                                      <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                    <span>{title}</span>
                                  </a>
                                );
                              }

                              if (type === "PHONE_NUMBER" && phone) {
                                return (
                                  <a
                                    key={btn.id || i}
                                    href={`tel:${phone}`}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/70 hover:bg-white border border-[#075E54]/20 rounded-lg text-[12px] font-semibold text-[#075E54] hover:text-[#064E47] transition shadow-xs"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                    </svg>
                                    <span>{title}</span>
                                  </a>
                                );
                              }

                              return (
                                <div
                                  key={btn.id || i}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/70 hover:bg-white border border-[#075E54]/20 rounded-lg text-[12px] font-semibold text-[#075E54] transition cursor-default shadow-xs"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 11.24V7.5a2.5 2.5 0 015 0v3.74" />
                                    <path d="M14 11h1a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6a2 2 0 012-2h1" />
                                  </svg>
                                  <span>{title}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Time + Ticks */}
                      <div className="mt-1 flex items-center gap-1 justify-end text-[10px] text-[#667781]">
                        <span>{timeStr}</span>
                        {isAgent && (
                          <>
                            {msg.status === "sent" && (
                              <Check size={14} className="text-[#667781]" />
                            )}
                            {msg.status === "delivered" && (
                              <CheckCheck
                                size={14}
                                className="text-[#667781]"
                              />
                            )}
                            {(msg.status === "read" || msg.isRead) && (
                              <CheckCheck
                                size={14}
                                className="text-[#53BDEB]"
                              />
                            )}
                            {!msg.status && !msg.isRead && (
                              <CheckCheck
                                size={14}
                                className="text-[#667781]"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center my-12">
                  <div className="w-20 h-20 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center mb-3 shadow-sm">
                    <FaWhatsapp className="w-10 h-10 text-[#25D366]/40" />
                  </div>
                  <p className="text-xs text-[#54656F] font-medium bg-white/60 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              )}
              {/* Live Typing Indicator Pill */}
              {typingAgents.filter((t) => String(t.userId) !== String(user?.id)).length > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full w-fit shadow-md border border-emerald-200/60 mb-2 transition-all">
                  <span className="text-xs text-[#075E54] font-bold">
                    {typingAgents
                      .filter((t) => String(t.userId) !== String(user?.id))
                      .map((t) => t.name)
                      .join(", ")}{" "}
                    {typingAgents.filter((t) => String(t.userId) !== String(user?.id)).length === 1 ? "is" : "are"}{" "}
                    typing
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce" />
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="bg-[#F0F2F5] px-4 py-3 flex flex-col gap-2.5 shrink-0 relative z-10"
            >
              {activeChat.contact?.isBlocked && (
                <div className="flex items-center justify-between text-xs bg-red-50 text-red-800 px-4 py-2.5 rounded-xl border border-red-100">
                  <span className="font-semibold">
                    This contact is blocked. You cannot send or receive
                    messages.
                  </span>
                </div>
              )}


              {/* {["RESOLVED", "CLOSED"].includes(activeChat.status) &&
                !activeChat.contact?.isBlocked && (
                  <div className="flex items-center justify-between text-xs bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl border border-amber-100">
                    <span className="font-semibold">
                      Conversation is{" "}
                      <strong className="capitalize">
                        {activeChat.status.toLowerCase()}
                      </strong>
                      . Sending a message will reopen it.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus("OPEN")}
                      className="text-amber-900 font-bold hover:underline px-2 py-0.5 rounded-md hover:bg-amber-100 transition"
                    >
                      Reopen
                    </button>
                  </div>
                )} */}

                {/* REPLACE WITH (adds the banner right underneath it): ** */}


                {["RESOLVED", "CLOSED"].includes(activeChat.status) &&
                !activeChat.contact?.isBlocked && (
                  <div className="flex items-center justify-between text-xs bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl border border-amber-100">
                    <span className="font-semibold">
                      Conversation is{" "}
                      <strong className="capitalize">
                        {activeChat.status.toLowerCase()}
                      </strong>
                      . Sending a message will reopen it.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus("OPEN")}
                      className="text-amber-900 font-bold hover:underline px-2 py-0.5 rounded-md hover:bg-amber-100 transition"
                    >
                      Reopen
                    </button>
                  </div>
                )}

                            {/* ── 24-Hour Window Expired Alert ── */}
              {activeChat &&
                is24hExpired(activeChat) &&
                activeChat.status === "OPEN" &&
                !activeChat.contact?.isBlocked && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 shadow-xs mb-2">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span className="font-medium text-[11px] text-amber-800">
                      ℹ️ It has been more than 24 hours since the customer messaged you. You can only respond using a Template.
                    </span>
                  </div>
                )}

              

              {/* File Preview */}
              {selectedFile && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="preview"
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-emerald-100"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#075E54]/10 flex flex-col items-center justify-center shrink-0">
                      <Paperclip size={20} className="text-[#075E54]" />
                      <span className="text-[9px] text-[#075E54] font-bold mt-1 uppercase">
                        {selectedFile.name.split(".").pop()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#111B21] truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-[#667781] mb-1.5">
                      {selectedFile.size < 1024 * 1024
                        ? (selectedFile.size / 1024).toFixed(1) + " KB"
                        : (selectedFile.size / (1024 * 1024)).toFixed(1) +
                          " MB"}
                    </p>
                    <input
                      type="text"
                      placeholder="Add a caption..."
                      value={fileCaption}
                      onChange={(e) => setFileCaption(e.target.value)}
                      className="w-full text-xs py-1 px-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#25D366]/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelFile}
                      className="p-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-500 transition"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSendFile}
                      disabled={uploadingFile}
                      className="p-1.5 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white transition disabled:opacity-50"
                    >
                      {uploadingFile ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Input Row */}
              <div className="flex items-center gap-2">
              

                              {/* ── Emoji Picker Button ── */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    disabled={activeChat.contact?.isBlocked}
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
                    title="Emoji"
                  >
                    <Smile size={22} />
                  </button>

                                  {/* Emoji Picker Popup - Ultra Compact */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={260}
                        height={320}
                        searchDisabled={false}
                        skinTonesDisabled={true}
                        previewConfig={{ showPreview: false }}
                        lazyLoadEmojis={true}
                        emojiStyle="native"
                        style={{
                          fontSize: "12px",
                          "--epr-emoji-size": "20px",
                          "--epr-category-navigation-button-size": "24px",
                          "--epr-header-padding": "8px",
                          "--epr-search-input-height": "32px",
                          "--epr-emoji-padding": "4px",
                          "--epr-category-label-height": "24px",
                        }}
                      />
                    </div>
                  )}
                </div>


                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,video/mp4,audio/mpeg,audio/ogg"
                  onChange={handleFileSelect}
                />

                                {/* ── WhatsApp-Style Hidden File Inputs ── */}
                <input
                  type="file"
                  ref={documentInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
                  onChange={handleFileSelect}
                />
                <input
                  type="file"
                  ref={photoVideoInputRef}
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                />
                <input
                  type="file"
                  ref={audioInputRef}
                  className="hidden"
                  accept="audio/*"
                  onChange={handleFileSelect}
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                />

                              {/* ── NEW WhatsApp-Style Attach Button with Menu ── */}
                <div className="relative" ref={attachMenuRef}>
                  <button
                    type="button"
                    disabled={activeChat.contact?.isBlocked}
                    onClick={() => setShowAttachMenu((prev) => !prev)}
                    className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
                    title="Attach"
                  >
                    <Paperclip size={20} className="rotate-45" />
                  </button>

                                    {/* ── Popup Attach Menu - Compact ── */}
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-xl shadow-2xl border border-emerald-100 overflow-hidden min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                      {/* Document */}
                      <button
                        type="button"
                        onClick={() => handleAttachMenuClick("document")}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#7F66FF]/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F66FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-[#111B21]">Document</span>
                      </button>

                      {/* Photos & Videos */}
                      <button
                        type="button"
                        onClick={() => handleAttachMenuClick("photos")}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#007BFC]/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007BFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-[#111B21]">Photos & videos</span>
                      </button>

                      {/* Camera */}
                      {/*
                      <button
                        type="button"
                        onClick={() => handleAttachMenuClick("camera")}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#FF2E74]/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF2E74" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-[#111B21]">Camera</span>
                      </button>
                      */}


                      {/* Audio */}
                      <button
                        type="button"
                        onClick={() => handleAttachMenuClick("audio")}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#F7943D]/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F7943D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-[#111B21]">Audio</span>
                      </button>

                      {/* Contact */}
                      {/*
                      <button
                        type="button"
                        onClick={() => handleAttachMenuClick("contact")}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#009DE1]/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#009DE1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-[#111B21]">Contact</span>
                      </button>
                      */}

                      {/* Location */}
                      <button
                        type="button"
                        onClick={() => handleAttachMenuClick("location")}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#00A884]/10 flex items-center justify-center shrink-0">
                          <MapPin size={14} className="text-[#00A884]" />
                        </div>
                        <span className="text-xs font-medium text-[#111B21]">Location</span>
                      </button>
                    </div>
                  )}
                </div>


                {!isRecording ? (
                  <input
                    type="text"
                    placeholder={
                      activeChat.contact?.isBlocked
                        ? "Cannot send messages to a blocked contact"
                        : ["RESOLVED", "CLOSED"].includes(activeChat.status)
                          ? "Type a message to reopen chat..."
                          : "Type a message"
                    }
                    value={typedMessage}
                    disabled={activeChat.contact?.isBlocked}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTypedMessage(val);
                      if (socket && activeChatId) {
                        if (val.trim().length > 0) {
                          if (!isTypingRef.current) {
                            isTypingRef.current = true;
                            socket.emit("agent_typing_start", { conversationId: activeChatId });
                          }
                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                          typingTimeoutRef.current = setTimeout(() => {
                            isTypingRef.current = false;
                            socket.emit("agent_typing_stop", { conversationId: activeChatId });
                          }, 2500);
                        } else {
                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                          isTypingRef.current = false;
                          socket.emit("agent_typing_stop", { conversationId: activeChatId });
                        }
                      }
                    }}
                    className="flex-1 py-2.5 px-4 bg-white rounded-lg border-0 text-sm text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 disabled:bg-[#F0F2F5] disabled:text-[#667781] disabled:cursor-not-allowed transition"
                  />
                ) : (
                  <div className="flex-1 flex items-center gap-2 py-2.5 px-4 bg-white rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-red-500 font-medium">
                      Recording... {recordingTime}s
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelRecording}
                      className="ml-auto text-red-400 hover:text-red-600 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {typedMessage.trim() || selectedFile ? (
                  <button
                    type="submit"
                    disabled={activeChat.contact?.isBlocked}
                    className="w-11 h-11 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white shrink-0 flex items-center justify-center shadow-md hover:shadow-lg transition duration-150 disabled:opacity-50"
                  >
                    <Send size={18} className="ml-0.5" />
                  </button>
                ) : isRecording ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 text-white shrink-0 flex items-center justify-center shadow-md hover:shadow-lg transition duration-150"
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={activeChat.contact?.isBlocked}
                    className="w-11 h-11 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white shrink-0 flex items-center justify-center shadow-md hover:shadow-lg transition duration-150 disabled:opacity-50"
                  >
                    <Mic size={18} />
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <div
            className="flex-1 flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: "#F0F2F5" }}
          >
            <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-10 flex flex-col items-center max-w-sm">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 flex items-center justify-center mb-4">
                <FaWhatsapp className="w-12 h-12 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold text-[#111B21] mb-1">
                WhatsApp Business
              </h3>
              <p className="text-sm text-[#667781] text-center mb-4">
                Send and receive messages from your customers. Select a
                conversation to get started.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-[#8696A0]">
                <svg
                  viewBox="0 0 10 10"
                  className="w-3 h-3"
                  fill="currentColor"
                >
                  <path d="M5 0a5 5 0 100 10A5 5 0 005 0zm.5 7.5h-1v-1h1v1zm0-2h-1v-3h1v3z" />
                </svg>
                End-to-end encrypted
              </div>
            </div>
          </div>
        )}
      </div>
      {/* ══ End Middle Chat Area ══ */}

      {/* ══════════════════════════════════════
          RIGHT PANEL
      ══════════════════════════════════════ */}
           {activeChat && (
  <div
    className={`border-l border-emerald-100 flex flex-col overflow-y-auto shrink-0 bg-white transition-all duration-300 ease-in-out ${
      showContactPanel ? "w-72 opacity-100" : "w-0 opacity-0 border-l-0"
    }`}
  >
    {/* Profile Header */}
    <div className="bg-gradient-to-b from-[#075E54] to-[#128C7E] px-6 pt-6 pb-8 flex flex-col items-center text-center relative">

        {/* ⭐ NEW: Close Button (X) ⭐ */}
  <button
    onClick={() => setShowContactPanel(false)}
    className="absolute top-3 right-3 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
    title="Close panel"
  >
    <X size={16} />
  </button>
  {/* ⭐ END NEW BUTTON ⭐ */}

            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-xl ring-4 ring-white/20 shadow-lg mb-3 ${getAvatarStyle(
                activeChat.contact?.name,
              )}`}
            >
              {(activeChat.contact?.name || "C").charAt(0)}
            </div>
            <h3 className="font-bold text-white text-base leading-none">
              {activeChat.contact?.name}
            </h3>
            <p className="text-xs text-emerald-200 mt-1.5 font-mono">
              {activeChat.contact?.phone}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeChat.status === "OPEN" ? "bg-[#25D366]" : "bg-[#667781]"
                }`}
              />
              <span className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">
                {activeChat.status}
              </span>
            </div>
          </div>

          {/* Info Sections */}
          <div className="p-4 space-y-3">
            {/* Contact Info */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5 space-y-2.5">
              <p className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={11} /> Contact Info
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-[#25D366] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#667781]">Phone</p>
                    <p className="text-[11px] font-semibold text-[#111B21]">
                      {activeChat.contact?.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-[#25D366] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#667781]">Email</p>
                    <p className="text-[11px] font-semibold text-[#111B21]">
                      {activeChat.contact?.email || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="text-[#25D366] shrink-0" />
                  <div>
                    <p className="text-[9px] text-[#667781]">Company</p>
                    <p className="text-[11px] font-semibold text-[#111B21]">
                      {activeChat.contact?.company || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck size={11} /> Agent
                </p>
                <span className="text-[10px] font-semibold text-[#111B21]">
                  {activeChat.contact?.assignedTo ? (
                    allAgents.find(
                      (a) => a.id === activeChat.contact?.assignedTo,
                    )?.name || "Assigned"
                  ) : (
                    <span className="text-[#667781] font-normal italic">
                      Unassigned
                    </span>
                  )}
                </span>
              </div>
              {userRole === "admin" && (
                <div className="flex items-center gap-1.5 mt-2">
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="flex-1 text-[10px] py-1 px-1.5 rounded-md border border-slate-200 bg-white text-[#111B21] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
                  >
                    <option value="">
                      {activeChat.contact?.assignedTo
                        ? "Change agent"
                        : "Select agent"}
                    </option>
                    {allAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignAgent}
                    disabled={!selectedAgent || assigningUser}
                    className="px-2 py-1 bg-[#075E54] hover:bg-[#064E47] text-white text-[9px] font-bold rounded-md transition disabled:opacity-30"
                  >
                    {assigningUser ? "..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Tag size={11} /> Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {(activeChat.contact?.contactTags || []).map((ct, i) => (
                  <span
                    key={ct.tag?.id || i}
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold border ${getTagColor(
                      ct.tag?.name,
                    )}`}
                  >
                    {ct.tag?.name}
                    {userRole === "admin" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(ct.tag?.id)}
                        className="hover:text-red-500 transition ml-0.5"
                        title="Remove"
                      >
                        <X size={8} />
                      </button>
                    )}
                  </span>
                ))}
                {(activeChat.contact?.contactTags || []).length === 0 && (
                  <span className="text-[10px] text-[#667781] italic">
                    No tags
                  </span>
                )}
              </div>
              {userRole === "admin" && (
                <div className="flex items-center gap-1.5 mt-2">
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="flex-1 text-[10px] py-1 px-1.5 rounded-md border border-slate-200 bg-white text-[#111B21] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
                  >
                    <option value="">+ Add tag</option>
                    {allTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignTag}
                    disabled={!selectedTag || assigningTag}
                    className="px-2 py-1 bg-[#075E54] hover:bg-[#064E47] text-white text-[9px] font-bold rounded-md transition disabled:opacity-30"
                  >
                    {assigningTag ? "..." : "Add"}
                  </button>
                </div>
              )}
            </div>

            {/* Session */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5 space-y-1.5">
              <p className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays size={11} /> Session
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#667781]">Created</span>
                <span className="text-[10px] text-[#111B21] font-semibold">
                  {formatDate(activeChat.createdAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="h-px bg-emerald-100" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#667781]">Last Activity</span>
                <span className="text-[10px] text-[#111B21] font-semibold">
                  {formatDate(activeChat.updatedAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ══ End Right Panel ══ */}

      {/* ══════════════════════════════════════
          NEW CHAT MODAL
      ══════════════════════════════════════ */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#075E54] flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <MessageSquarePlus size={16} className="text-white" />
                <h2 className="text-base font-bold text-white">
                  New Conversation
                </h2>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4 max-h-[400px] overflow-hidden">
              <div className="relative">
                <Search
                  className="absolute left-3 top-2.5 text-[#54656F]"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-[#F0F2F5] rounded-lg border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5]">
                {loadingContacts ? (
                  <div className="text-center text-xs text-[#667781] py-6 flex items-center justify-center gap-2">
                    <RefreshCw
                      size={14}
                      className="animate-spin text-[#25D366]"
                    />
                    Loading contacts...
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContactForChat(contact.id)}
                      className="w-full text-left py-3 px-2 hover:bg-[#F0F2F5] transition flex items-center gap-3 rounded-xl"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarStyle(
                          contact.name,
                        )}`}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-[#111B21] truncate">
                            {contact.name}
                          </p>
                          {contact.isBlocked && (
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0 border border-red-100">
                              Blocked
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#667781] font-mono mt-0.5">
                          {contact.phone}
                        </p>
                      </div>
                      <FaWhatsapp className="w-4 h-4 text-[#25D366] shrink-0 opacity-50" />
                    </button>
                  ))
                )}
                {!loadingContacts && filteredContacts.length === 0 && (
                  <p className="text-center text-xs text-[#667781] py-6">
                    No matching contacts found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          ARCHIVED CHATS MODAL
      ══════════════════════════════════════ */}
      {showArchived && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-[#075E54] flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                <h2 className="text-base font-bold text-white">
                  Archived Chats
                </h2>
                {archivedChats.length > 0 && (
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {archivedChats.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowArchived(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-[#F0F2F5]">
              {loadingArchived && (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#667781]">
                  <RefreshCw
                    size={14}
                    className="animate-spin text-[#25D366]"
                  />
                  Loading archived chats...
                </div>
              )}

              {!loadingArchived && archivedChats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 px-4">
                  <div className="w-16 h-16 rounded-full bg-[#F0F2F5] flex items-center justify-center mb-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#667781"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="21 8 21 21 3 21 3 8" />
                      <rect x="1" y="3" width="22" height="5" />
                      <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#667781]">
                    No archived chats
                  </p>
                  <p className="text-xs text-[#8696A0] mt-1 text-center">
                    Archived conversations will appear here
                  </p>
                </div>
              )}

              {!loadingArchived &&
                archivedChats.map((chat, archIdx) => {
                  const contactName = chat.contact?.name || "Unknown";
                  const lastMsg = chat.messages?.[0];
                  const isUnarchiving = unarchivingId === chat.id;
                  const archivedDate = formatDate(chat.archivedAt, {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <div
                      key={chat.id || `archived-${archIdx}`}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5F6F6] transition"
                    >
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarStyle(
                          contactName,
                        )}`}
                      >
                        {contactName.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#111B21] truncate">
                            {contactName}
                          </p>
                          <span className="text-[10px] text-[#8696A0] shrink-0">
                            {archivedDate}
                          </span>
                        </div>
                        <p className="text-xs text-[#667781] truncate mt-0.5">
                          {formatLastMessagePreview(lastMsg)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-[#8696A0] font-mono">
                            {chat.contact?.phone}
                          </span>
                          {(chat.contact?.contactTags || [])
                            .slice(0, 1)
                            .map((ct, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              >
                                {ct.tag?.name}
                              </span>
                            ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnarchiveConversation(chat.id)}
                        disabled={isUnarchiving}
                        title="Unarchive this conversation"
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-[#075E54] hover:bg-[#064E47] text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50"
                      >
                        {isUnarchiving ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="21 8 21 21 3 21 3 8" />
                              <rect x="1" y="3" width="22" height="5" />
                              <line x1="10" y1="12" x2="14" y2="12" />
                            </svg>
                            <span>Unarchive</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            {!loadingArchived && archivedChats.length > 0 && (
              <div className="px-6 py-3 border-t border-[#F0F2F5] text-center bg-[#F9FAFB]">
                <p className="text-[10px] text-[#8696A0]">
                  {archivedChats.length} archived conversation
                  {archivedChats.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
     

            {/* ══ End Archived Modal ══ */}

      {/* ══════════════════════════════════════
          LOCATION MODAL
      ══════════════════════════════════════ */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">

            {/* Header */}
            <div className="px-6 py-4 bg-[#075E54] flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-white" />
                <h2 className="text-base font-bold text-white">Share Location</h2>
              </div>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationError("");
                  setLocationForm({ name: "", address: "", latitude: "", longitude: "" });
                }}
                className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">

              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                  Place Name{" "}
                  <span className="text-[#667781] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Office"
                  value={locationForm.name}
                  onChange={(e) =>
                    setLocationForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                  Address{" "}
                  <span className="text-[#667781] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. MG Road, Bangalore"
                  value={locationForm.address}
                  onChange={(e) =>
                    setLocationForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                />
              </div>

              {/* Lat / Lng */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                    Latitude <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 12.9716"
                    value={locationForm.latitude}
                    onChange={(e) =>
                      setLocationForm((prev) => ({ ...prev, latitude: e.target.value }))
                    }
                    step="any"
                    className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                    Longitude <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 77.5946"
                    value={locationForm.longitude}
                    onChange={(e) =>
                      setLocationForm((prev) => ({ ...prev, longitude: e.target.value }))
                    }
                    step="any"
                    className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                  />
                </div>
              </div>

              {/* Helper */}
              <p className="text-[10px] text-[#667781] flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Find coordinates: Google Maps → right click → copy lat/long
              </p>

              {/* Error */}
              {locationError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs text-red-600 font-medium">{locationError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationError("");
                    setLocationForm({ name: "", address: "", latitude: "", longitude: "" });
                  }}
                  disabled={sendingLocation}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendLocation}
                  disabled={
                    sendingLocation ||
                    !locationForm.latitude ||
                    !locationForm.longitude
                  }
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#075E54] hover:bg-[#064E47] text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingLocation ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <MapPin size={12} />
                      Send Location
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reassign Modal ── */}
      {showBulkReassignModal && (
        <div className="fixed inset-0 z-[60] bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#075E54] text-white flex justify-between items-center">
              <h2 className="font-bold">
                Bulk Reassign ({selectedConvIds.length})
              </h2>
              <button onClick={() => setShowBulkReassignModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#075E54] uppercase">
                  Assign To
                </label>
                <select
                  className="w-full mt-1 border rounded-xl p-2 text-sm"
                  value={bulkTargetUserId}
                  onChange={(e) => setBulkTargetUserId(e.target.value)}
                >
                  <option value="">— Unassign —</option>
                  {allAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-2 bg-gray-100 rounded-xl text-sm"
                  onClick={() => setShowBulkReassignModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-2 bg-[#075E54] text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  disabled={bulkReassigning}
                  onClick={handleBulkReassign}
                >
                  {bulkReassigning ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
    DELETE ALL CHATS MODAL
══════════════════════════════════════ */}
      {showDeleteAllConfirm && userRole === "admin" && (
        <div className="fixed inset-0 z-[60] bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-red-100 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 bg-red-500 flex items-center gap-2.5 rounded-t-3xl">
              <Trash2 size={16} className="text-white" />
              <h2 className="text-base font-bold text-white">
                Delete All Chats
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#111B21] font-medium mb-1">
                Delete all {chats.length} conversation(s)?
              </p>
              <p className="text-xs text-[#667781] mb-6">
                ⚠️ This will permanently delete all messages from all chats.
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  disabled={deletingAllChats}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllChats}
                  disabled={deletingAllChats}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deletingAllChats ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete All"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL MEDIA PREVIEW LIGHTBOX MODAL ── */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition shadow-lg z-10"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>

            {/* IMAGE PREVIEW */}
            {(previewImageModal.type === "IMAGE" || !previewImageModal.type) && (
              <img
                src={previewImageModal.url}
                alt={previewImageModal.name || "Preview"}
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            )}

            {/* VIDEO PREVIEW */}
            {previewImageModal.type === "VIDEO" && (
              <video
                src={previewImageModal.url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            )}

            {/* AUDIO PREVIEW */}
            {previewImageModal.type === "AUDIO" && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl text-center shadow-2xl min-w-[320px]">
                <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto mb-3 text-[#25D366]">
                  <Mic size={24} />
                </div>
                <p className="text-white text-sm font-semibold mb-4 truncate max-w-xs mx-auto">
                  {previewMediaModal?.name || "Voice / Audio Message"}
                </p>
                <audio src={previewImageModal.url} controls autoPlay className="w-full" />
              </div>
            )}

            {/* FILE / DOCUMENT PREVIEW */}
            {previewImageModal.type === "FILE" && (
              <div className="w-full h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/10">
                <div className="px-4 py-3 bg-[#075E54] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip size={18} />
                    <span className="font-semibold text-sm truncate">
                      {previewImageModal.name || "Document Viewer"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={previewImageModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition text-white"
                    >
                      Open in New Tab
                    </a>
                    <a
                      href={previewImageModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewImageModal.name}
                      className="px-3 py-1.5 bg-white text-[#075E54] hover:bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      Download
                    </a>
                  </div>
                </div>
                <iframe
                  src={previewImageModal.url}
                  title={previewImageModal.name || "Document"}
                  className="w-full flex-1 border-none bg-gray-50"
                />
              </div>
            )}

            {/* Caption & Filename footer (for IMAGE/VIDEO/AUDIO) */}
            {(previewImageModal.caption || previewImageModal.name) && previewImageModal.type !== "FILE" && (
              <div className="mt-4 text-center px-4 py-2.5 bg-black/60 rounded-xl text-white/90 text-sm backdrop-blur-md max-w-xl shadow-lg border border-white/10">
                {previewImageModal.caption && (
                  <p className="font-semibold text-white">{previewImageModal.caption}</p>
                )}
                {previewImageModal.name && (
                  <p className="text-xs text-white/60 mt-0.5">{previewImageModal.name}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
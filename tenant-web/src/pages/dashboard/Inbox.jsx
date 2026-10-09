// src/pages/dashboard/Inbox.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from "react-icons/fa";
import api from "../../lib/axios";
import EmojiPicker from "emoji-picker-react";
import {
  Search,
  Pin,
  Filter,
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
  ChevronDown,
  ShoppingBag,
  Navigation,
  ExternalLink,
  Copy,
  FileText,
  Zap,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import CallMessageBubble from "../../components/inbox/CallMessageBubble";
import ContactCallsDrawer from "../../components/inbox/ContactCallsDrawer";
import ContactPanel from "../../components/inbox/layout/ContactPanel";
import ChatSidebar from "../../components/inbox/layout/ChatSidebar";
import ChatInput from "../../components/inbox/layout/ChatInput";
import ChatHeader from "../../components/inbox/layout/ChatHeader";
import ChatFeed from "../../components/inbox/layout/ChatFeed";
import NewChatModal from "../../components/inbox/modals/NewChatModal";
import LocationModal from "../../components/inbox/modals/LocationModal";
import MediaPreviewModal from "../../components/inbox/modals/MediaPreviewModal";
import MediaStagingOverlay from "../../components/inbox/modals/MediaPreviewModal";
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
  getConversationMedia,
  togglePinConversation,
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
import { getQuickReplies } from "../../services/quickReply.service";
import QuickReplyPopover from "../../components/inbox/QuickReplyPopover";
import { useCallStore } from "../../store/useCallStore";
import * as webrtcService from "../../lib/webrtcService";

export default function Inbox() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, accessToken } = useAuthStore();
  const setCall = useCallStore(s => s.setCall);
  const globalActiveCall = useCallStore(s => s.activeCall);

  const handleRequestCallPermission = async (contact) => {
    try {
      const res = await api.post('/whatsapp/calls/permissions/request', { contactId: contact.id });
      if (res.data?.success) {
        toast.success("Call permission request sent to user!");
      } else {
        toast.error("Failed to send permission request.");
      }
    } catch (err) {
      console.error(err);
      toast.error(typeof err.response?.data?.error === 'object' ? JSON.stringify(err.response.data.error) : (err.response?.data?.error || err.message || "Error sending permission request."));
    }
  };

  const handleInitiateCall = async (contact) => {
    if (globalActiveCall) return toast.error("A call is already in progress.");
    try {
      const sdpOffer = await webrtcService.initiateOutboundCall();
      const res = await api.post('/whatsapp/calls/initiate', {
        contactId: contact.id,
        conversationId: activeChatId,
        sdpOffer
      });
      if (res.data?.success) {
        const callId = res.data?.callId || res.data?.data?.calls?.[0]?.id || res.data?.data?.id;
        const callData = {
          wacid: callId || 'temp_' + Date.now(),
          status: 'DIALING',
          direction: 'BUSINESS_INITIATED',
          contactId: contact.id,
          fromNumber: contact.phone || null,
        };
        setCall(callData);
        setActiveChatCalls((prev) => [
          ...prev.filter((c) => c.wacid !== callData.wacid),
          {
            ...callData,
            createdAt: new Date().toISOString(),
            duration: 0,
            recordings: [],
            transcripts: [],
          },
        ]);
      } else {
        toast.error("Failed to start call: Invalid response from Meta.");
        webrtcService.endCall();
      }
    } catch (err) {
      webrtcService.endCall();
      if (err.response?.data?.error === 'NO_CALL_PERMISSION') {
        toast.error("User has not granted call permission.");
      } else {
        toast.error(err.response?.data?.message || err.message || "Failed to initiate call.");
      }
    }
  };

  const userRole = user?.type === "TENANT" ? "admin" : "agent";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlConversationId = searchParams.get("conversationId");
  const filter =
    searchParams.get("filter") || (userRole === "admin" ? "all" : "my");
  const activeTab = searchParams.get("tab") || "all";

    // ── Core State ──
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(urlConversationId || null);
  const [loadingMessages, setLoadingMessages] = useState(false);

    // Handle Toggle Pin / Unpin Chat (Max 3 pinned chats)
  const handleTogglePin = async (e, convId) => {
    e?.stopPropagation();
    if (!convId) return;

    const targetChat = chats.find((c) => String(c.id) === String(convId));
    if (!targetChat) return;

    const isCurrentlyPinned = Boolean(targetChat.isPinned);

    // 1️⃣ Friendly limit check before calling backend API
    if (!isCurrentlyPinned) {
      const currentPinnedCount = chats.filter((c) => Boolean(c.isPinned)).length;
      if (currentPinnedCount >= 3) {
        toast.info("Maximum 3 chats can be pinned at a time.");
        return;
      }
    }

    try {
      const res = await togglePinConversation(convId);

      if (res.success && res.conversation) {
        const newPinnedState = Boolean(res.conversation.isPinned);
        toast.success(newPinnedState ? "Chat pinned to top" : "Chat unpinned");

        setChats((prev) => {
          const updated = prev.map((c) =>
            String(c.id) === String(convId)
              ? {
                  ...c,
                  isPinned: newPinnedState,
                  pinnedAt: res.conversation.pinnedAt,
                }
              : c
          );

          // Strict boolean sorting function
          return [...updated].sort((a, b) => {
            const aPinned = Boolean(a.isPinned);
            const bPinned = Boolean(b.isPinned);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            if (aPinned && bPinned) {
              return new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0);
            }
            return (
              new Date(b.updatedAt || b.lastActivityAt || 0) -
              new Date(a.updatedAt || a.lastActivityAt || 0)
            );
          });
        });
      } else {
        toast.info(res.message || "Maximum 3 chats can be pinned at a time.");
      }
    } catch (err) {
      toast.info("Maximum 3 chats can be pinned at a time.");
    }
  };

  // Sync activeChatId with URL conversationId (e.g. clicking Inbox in sidebar clears selection)
  useEffect(() => {
    setActiveChatId(urlConversationId || null);
  }, [urlConversationId]);

  const handleSelectChat = useCallback(
    (chatId) => {
      if (String(chatId) === String(activeChatId)) return;
      setActiveChatId(chatId);
      setStagedQuickReply(null);
      setShowQuickReplyPopover(false);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("conversationId", String(chatId));
          return next;
        },
        { replace: true }
      );
    },
    [activeChatId, setSearchParams]
  );
  const [messages, setMessages] = useState([]);
  const [activeChatCalls, setActiveChatCalls] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  // Merged timeline of messages and calls chronologically
  const timelineItems = React.useMemo(() => {
    const msgs = (messages || []).map((m) => ({
      ...m,
      _itemType: "MESSAGE",
      _time: new Date(m.createdAt).getTime() || 0,
    }));
    const cls = (activeChatCalls || []).map((c) => ({
      ...c,
      _itemType: "CALL",
      _time: new Date(c.createdAt).getTime() || 0,
    }));
    return [...msgs, ...cls].sort((a, b) => a._time - b._time);
  }, [messages, activeChatCalls]);

  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  const [selectedChannel, setSelectedChannel] = useState("ALL");
  const [channelCounts, setChannelCounts] = useState({
    ALL: 0,
    WHATSAPP: 0,
    MESSENGER: 0,
    INSTAGRAM: 0,
  });
  const [showChannelFilter, setShowChannelFilter] = useState(false);
  const channelFilterRef = useRef(null);

  // ── Presence & Collision State ──
  const [activeViewers, setActiveViewers] = useState([]);
  const [typingAgents, setTypingAgents] = useState([]);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const prevChatIdRef = useRef(null);

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileCaption, setFileCaption] = useState("");

  // ── Quick Replies State ──
  const [quickRepliesList, setQuickRepliesList] = useState([]);
  const [showQuickReplyPopover, setShowQuickReplyPopover] = useState(false);
  const [filteredQuickReplies, setFilteredQuickReplies] = useState([]);
  const [quickReplySelectedIndex, setQuickReplySelectedIndex] = useState(0);
  const [stagedQuickReply, setStagedQuickReply] = useState(null);
  const lastQuickRepliesFetchRef = useRef(0);

  const loadQuickReplies = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && quickRepliesList.length > 0 && now - lastQuickRepliesFetchRef.current < 5 * 60 * 1000) {
      return;
    }
    try {
      const res = await getQuickReplies({ limit: 100, includeInactive: false });
      if (res.success && res.data) {
        setQuickRepliesList(res.data);
        lastQuickRepliesFetchRef.current = now;
      }
    } catch (err) {
      console.warn("Failed to load quick replies:", err);
    }
  }, [quickRepliesList.length]);

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  const interpolateQuickReply = (text, contact, authUser) => {
    if (!text) return "";
    return text
      .replace(/{{contactName}}/gi, contact?.name || "Customer")
      .replace(/{{contactPhone}}/gi, contact?.phone || "")
      .replace(/{{agentName}}/gi, authUser?.name || "Agent")
      .replace(/{{companyName}}/gi, authUser?.tenantName || "Our Company")
      .replace(/{{date}}/gi, new Date().toLocaleDateString())
      .replace(/{{time}}/gi, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  };

  const handleSelectQuickReply = (reply) => {
    if (!reply) return;
    const interpolated = interpolateQuickReply(reply.content, activeChat?.contact, user);
    setTypedMessage(interpolated);
    if (reply.mediaUrl) {
      setStagedQuickReply(reply);
    }
    setShowQuickReplyPopover(false);
    setFilteredQuickReplies([]);
  };
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showStagingEmojiPicker, setShowStagingEmojiPicker] = useState(false);
  const stagingEmojiPickerRef = useRef(null);

  // ── Audio Recording ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

    // ── Scroll ──
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

  const scrollToBottom = (smooth = false) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isScrolledUp =
      container.scrollHeight - container.scrollTop - container.clientHeight > 350;
    setShowScrollArrow(isScrolledUp);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, activeChatId]);

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
    name: "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const [locationError, setLocationError] = useState("");
  const [sendingLocation, setSendingLocation] = useState(false);

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

    // ── Right Contact Panel State & Media Tab State ──
  const [showContactPanel, setShowContactPanel] = useState(() => {
    const saved = localStorage.getItem("inbox_contact_panel_open");
    return saved === "true";
  });

  const [rightPanelSubView, setRightPanelSubView] = useState("info"); // "info" | "media"
  const [mediaActiveTab, setMediaActiveTab] = useState("media"); // "media" | "docs" | "links"
  const [mediaItems, setMediaItems] = useState([]);
  const [loadingMediaItems, setLoadingMediaItems] = useState(false);
  const [mediaCategoryCounts, setMediaCategoryCounts] = useState({ media: 0, docs: 0, links: 0 });

  // Load Media Items for Right Panel
  const loadMediaCategory = useCallback(async (convId, category) => {
    if (!convId) return;
    setLoadingMediaItems(true);
    try {
      const res = await getConversationMedia(convId, category, 1, 50);
      if (res.success && res.data) {
        setMediaItems(res.data.items || []);
        if (res.data.counts) {
          setMediaCategoryCounts(res.data.counts);
        }
      }
    } catch (err) {
      console.error("Failed to fetch media:", err);
    } finally {
      setLoadingMediaItems(false);
    }
  }, []);

  // Fetch initial summary count when active chat changes
  useEffect(() => {
    if (activeChatId && showContactPanel) {
      loadMediaCategory(activeChatId, mediaActiveTab);
    }
  }, [activeChatId, showContactPanel, mediaActiveTab, loadMediaCategory]);

  // Reset subview to "info" when switching active chat
  useEffect(() => {
    setRightPanelSubView("info");
  }, [activeChatId]);

  // Load Calls for Active Conversation
  const loadConversationCalls = useCallback(async (convId) => {
    if (!convId) {
      setActiveChatCalls([]);
      return;
    }
    setLoadingCalls(true);
    try {
      const res = await api.get(`/whatsapp/calls/conversation/${convId}`);
      if (res.data?.success) {
        setActiveChatCalls(res.data.data || []);
      }
    } catch (err) {
      console.warn("Failed to load calls for conversation:", err);
    } finally {
      setLoadingCalls(false);
    }
  }, []);

  // Fetch calls when active chat changes
  useEffect(() => {
    if (activeChatId) {
      loadConversationCalls(activeChatId);
    } else {
      setActiveChatCalls([]);
    }
  }, [activeChatId, loadConversationCalls]);

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
  
  // const is24hExpired = (chat) => {
  //   if (!chat) return false;

  //   // 1. Check incomingAt (recorded when customer messages)
  //   let lastCustomerTime = chat.incomingAt ? new Date(chat.incomingAt).getTime() : null;

  //   // 2. Fallback: Search messages array for the last customer message
  //   if (!lastCustomerTime && Array.isArray(chat.messages)) {
  //     const lastInboundMsg = chat.messages.find(
  //       (m) => m.isFromCustomer || m.direction === "INBOUND" || m.senderType === "CONTACT"
  //     );
  //     if (lastInboundMsg?.createdAt) {
  //       lastCustomerTime = new Date(lastInboundMsg.createdAt).getTime();
  //     }
  //   }

  //   // 3. If customer NEVER messaged -> Session is EXPIRED by default!
  //   if (!lastCustomerTime) return true;

  //   if (isNaN(lastCustomerTime)) return false;

  //   // 4. Calculate hours difference
  //   const hoursDiff = (Date.now() - lastCustomerTime) / (1000 * 60 * 60);
  //   return hoursDiff >= 24;
  // };
  

      // Helper: Check if 24-hour messaging window has expired since customer's last message
      // Helper: Check if 24-hour messaging window has expired since customer's last message
  const is24hExpired = (chat) => {
    if (!chat) return false;

    // Do NOT show banner if chat is already RESOLVED or CLOSED
    if (chat.status !== "OPEN") return false;

    // Get the MOST RECENT customer message from the end of the messages array
    const inboundMsgs = (chat.messages || []).filter(
      (m) => m.isFromCustomer || m.direction === "INBOUND"
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


  // ── Helpers ──
  const formatLastMessagePreview = (msg) => {
    if (!msg) return "No messages yet";
    const type = msg.type?.toUpperCase();

    if (type === "CALL") {
      if (msg.status === "MISSED") return "📞 Missed Call";
      if (msg.status === "REJECTED") return "📞 Declined Call";
      if (msg.status === "FAILED") return "📞 Failed Call";
      return msg.direction === "BUSINESS_INITIATED" ? "📞 Outgoing Call" : "📞 Incoming Call";
    }

    if (type === "AUDIO") return "🎵 Voice message";
    if (type === "IMAGE") return msg.caption ? `📷 ${msg.caption}` : "📷 Photo";
    if (type === "VIDEO") return msg.caption ? `🎥 ${msg.caption}` : "🎥 Video";
    if (type === "FILE") return msg.mediaName ? `📄 ${msg.mediaName}` : "📄 Document";
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
      try {
        const res = await getAssignedConversations(1, 50, filter, selectedChannel);
        if (res.success) {
          const convList =
            res.data?.conversations ||
            res.data?.data?.conversations ||
            res.data?.data ||
            res.data ||
            [];

          setChats(convList);

          const returnedChannelCounts =
            res.data?.channelCounts || res.data?.data?.channelCounts;
          if (returnedChannelCounts) {
            setChannelCounts(returnedChannelCounts);
          }

          setUnreadMap((prev) => {
            const next = { ...prev };
            convList.forEach((c) => {
              if (next[String(c.id)] == null) next[String(c.id)] = 0;
            });
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, selectedChannel],
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
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let isCurrent = true;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await getConversationMessages(activeChatId, 50);
        if (isCurrent && res.success) {
          setMessages(res.data?.messages || []);
          setTimeout(() => scrollToBottom(true), 50);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (isCurrent) setLoadingMessages(false);
      }
    };
    loadMessages();
    return () => {
      isCurrent = false;
    };
  }, [activeChatId]);

  useEffect(() => {
    if (!socket) return;

    const refreshInboxAfterConnect = async () => {
      await loadConversations(true);
      if (!activeChatId) return;

      try {
        const res = await getConversationMessages(activeChatId, 50);
        if (res.success) setMessages(res.data?.messages || []);
      } catch (err) {
        console.error("Failed to refresh messages after socket connect:", err);
      }
    };

    socket.on("connect", refreshInboxAfterConnect);
    if (socket.connected) refreshInboxAfterConnect();

    return () => socket.off("connect", refreshInboxAfterConnect);
  }, [socket, activeChatId, loadConversations]);

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

      // const isFromCustomer = message?.isFromCustomer === true;
            const isFromCustomer =
        message?.isFromCustomer === true || message?.direction === "INBOUND";
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
        const isCustomerMsg =
          message?.isFromCustomer === true || message?.direction === "INBOUND";

        // Update the specific chat
        const updated = prevChats.map((c) => {
          if (String(c.id) === String(conversationId)) {
            return {
              ...c,
              status: "OPEN",
              incomingAt: isCustomerMsg ? msgCreatedAt : c.incomingAt,
              lastMessageAt: msgCreatedAt,
              updatedAt: msgCreatedAt,
              messages: [
                {
                  id: message.id,
                  text: message.text,
                  createdAt: msgCreatedAt,
                  isFromCustomer: message.isFromCustomer,
                  direction: message.direction,
                },
              ],
            };
          }
          return c;
        });

        // Reorder (only when we have a truly new message)
                // Reorder (only when we have a truly new message - pinned chats stay on top)
        return updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
          if (a.isPinned && b.isPinned) {
            return new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0);
          }

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
          
          const updated = [data.conversation, ...prev];
          
          // Sort: Pinned chats stay at the top, unpinned sorted by activity/created date
          return updated.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return b.isPinned ? -1 : 1;
            if (a.isPinned && b.isPinned) {
              return new Date(b.pinnedAt) - new Date(a.pinnedAt);
            }
            return new Date(b.lastActivityAt || b.updatedAt || b.createdAt) - new Date(a.lastActivityAt || a.updatedAt || a.createdAt);
          });
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

    const handleChannelError = (data) => {
      toast.error(`Channel Error (${data.channel}): ${data.error}`);
    };

    // ── Call Socket Listeners ──
    const handleCallStatusUpdate = (data) => {
      if (!data?.wacid) return;
      setActiveChatCalls((prev) => {
        const idx = prev.findIndex((c) => c.wacid === data.wacid);
        if (idx === -1) {
          if (activeChatId) loadConversationCalls(activeChatId);
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: data.status,
          ...(data.duration != null && { duration: data.duration }),
        };
        return updated;
      });
    };

    const handleCallRecordingReady = (data) => {
      if (!data?.wacid) return;
      setActiveChatCalls((prev) => {
        const found = prev.some((c) => c.wacid === data.wacid);
        if (!found) {
          if (activeChatId) loadConversationCalls(activeChatId);
          return prev;
        }
        return prev.map((c) => {
          if (c.wacid === data.wacid) {
            const recs = c.recordings || [];
            const newRec = data.recording || { mediaUrl: data.mediaUrl, downloadStatus: "DOWNLOADED" };
            return {
              ...c,
              recordings: [
                ...recs.filter((r) => r.id !== newRec.id && r.mediaUrl !== newRec.mediaUrl),
                newRec,
              ],
            };
          }
          return c;
        });
      });
    };

    const handleCallTranscriptReady = (data) => {
      if (!data?.wacid) return;
      setActiveChatCalls((prev) => {
        const found = prev.some((c) => c.wacid === data.wacid);
        if (!found) {
          if (activeChatId) loadConversationCalls(activeChatId);
          return prev;
        }
        return prev.map((c) => {
          if (c.wacid === data.wacid) {
            const trans = c.transcripts || [];
            const newTrans = data.transcript || { fullText: data.fullText, mediaUrl: data.mediaUrl, downloadStatus: "DOWNLOADED" };
            return {
              ...c,
              transcripts: [
                ...trans.filter((t) => t.id !== newTrans.id && t.mediaUrl !== newTrans.mediaUrl),
                newTrans,
              ],
            };
          }
          return c;
        });
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("conversations_reassigned", handleConversationsReassigned);
    socket.on("unread_count_update", handleUnreadCountUpdate);
    socket.on("conversation_assigned", handleConversationAssigned);
    socket.on("message_status_update", handleMessageStatusUpdate);
    socket.on("channel_error", handleChannelError);
    socket.on("call_status_update", handleCallStatusUpdate);
    socket.on("call_recording_ready", handleCallRecordingReady);
    socket.on("call_transcript_ready", handleCallTranscriptReady);
    
    const handleConversationsUpdated = () => {
      loadConversations(true);
    };
    socket.on("conversations_updated", handleConversationsUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("conversations_reassigned", handleConversationsReassigned);
      socket.off("unread_count_update", handleUnreadCountUpdate);
      socket.off("conversation_assigned", handleConversationAssigned);
      socket.off("message_status_update", handleMessageStatusUpdate);
      socket.off("channel_error", handleChannelError);
      socket.off("call_status_update", handleCallStatusUpdate);
      socket.off("call_recording_ready", handleCallRecordingReady);
      socket.off("call_transcript_ready", handleCallTranscriptReady);
      socket.off("conversations_updated", handleConversationsUpdated);
    };
  }, [socket, activeChatId, loadConversations, loadConversationCalls]);

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

  // ── Close staging emoji picker when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        stagingEmojiPickerRef.current &&
        !stagingEmojiPickerRef.current.contains(e.target)
      ) {
        setShowStagingEmojiPicker(false);
      }
    };
    if (showStagingEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStagingEmojiPicker]);

  // ── Discard media staging on Escape key ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedFile) {
        handleCancelFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFile]);

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

  // ── Close channel filter dropdown when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        channelFilterRef.current &&
        !channelFilterRef.current.contains(e.target)
      ) {
        setShowChannelFilter(false);
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
        `File too large. Max size is ${isImage ? "5MB" : isVideo || isAudio ? "16MB" : "100MB"
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
    setShowStagingEmojiPicker(false);
  };

  // ── Handle Staging Emoji Select ──
  const handleStagingEmojiClick = (emojiData) => {
    setFileCaption((prev) => prev + emojiData.emoji);
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

    const sendOptions = {};
    if (stagedQuickReply) {
      sendOptions.quickReplyId = stagedQuickReply.id;
      setStagedQuickReply(null);
    }

    const res = await sendMessage(activeChat.contact.id, messageText, sendOptions);
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
      // Automatically switch channel view to WHATSAPP if currently filtered on another channel
      if (selectedChannel !== "ALL" && selectedChannel !== "WHATSAPP") {
        setSelectedChannel("WHATSAPP");
      }
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

    // ── Media & Avatar Helpers ──
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

    const backend = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
    const cleanPath = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
    return `${backend}${cleanPath}`;
  };

  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const backend = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
    return `${backend}/${url.replace(/^\/+/, "")}`;
  };

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
        latitude: lat,
        longitude: lng,
        name: locationForm.name || undefined,
        address: locationForm.address || undefined,
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

  // ── Channel Counts ──
  const activeChannelCounts = {
    ALL: channelCounts?.ALL || chats.length,
    WHATSAPP:
      channelCounts?.WHATSAPP !== undefined && channelCounts?.WHATSAPP !== 0
        ? channelCounts.WHATSAPP
        : chats.filter(
          (c) =>
            !c.channel ||
            (c.channel || c.platform || "").toUpperCase() === "WHATSAPP"
        ).length,
    MESSENGER:
      channelCounts?.MESSENGER !== undefined && channelCounts?.MESSENGER !== 0
        ? channelCounts.MESSENGER
        : chats.filter(
          (c) => (c.channel || c.platform || "").toUpperCase() === "MESSENGER"
        ).length,
    INSTAGRAM:
      channelCounts?.INSTAGRAM !== undefined && channelCounts?.INSTAGRAM !== 0
        ? channelCounts.INSTAGRAM
        : chats.filter(
          (c) => (c.channel || c.platform || "").toUpperCase() === "INSTAGRAM"
        ).length,
  };

  // ── Filters ──
  const filteredChats = chats.filter((c) => {
    if (selectedChannel && selectedChannel !== "ALL") {
      const chatChannel = (c.channel || c.platform || "WHATSAPP").toUpperCase();
      if (chatChannel !== selectedChannel.toUpperCase()) return false;
    }
    const name = c.contact?.name || "";
    const phone = c.contact?.phone || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery)
    );
  });

  const tabCounts = {
    all: chats.filter((c) => {
      if (selectedChannel && selectedChannel !== "ALL") {
        const chatChannel = (c.channel || c.platform || "WHATSAPP").toUpperCase();
        return chatChannel === selectedChannel.toUpperCase();
      }
      return true;
    }).length,
    unread: chats.filter((c) => {
      if (selectedChannel && selectedChannel !== "ALL") {
        const chatChannel = (c.channel || c.platform || "WHATSAPP").toUpperCase();
        if (chatChannel !== selectedChannel.toUpperCase()) return false;
      }
      return c.status === "OPEN" && getUnreadCount(c.id) > 0;
    }).length,
    open: chats.filter((c) => {
      if (selectedChannel && selectedChannel !== "ALL") {
        const chatChannel = (c.channel || c.platform || "WHATSAPP").toUpperCase();
        if (chatChannel !== selectedChannel.toUpperCase()) return false;
      }
      return c.status === "OPEN";
    }).length,
    closed: chats.filter((c) => {
      if (selectedChannel && selectedChannel !== "ALL") {
        const chatChannel = (c.channel || c.platform || "WHATSAPP").toUpperCase();
        if (chatChannel !== selectedChannel.toUpperCase()) return false;
      }
      return c.status === "RESOLVED" || c.status === "CLOSED";
    }).length,
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

  const handleSelectChannelFilter = (channelKey) => {
    setSelectedChannel(channelKey);
    setShowChannelFilter(false);

    if (channelKey !== "ALL" && activeChat) {
      const currentChatChannel = (activeChat.channel || "WHATSAPP").toUpperCase();
      if (currentChatChannel !== channelKey.toUpperCase()) {
        setActiveChatId(null);
        const params = { filter };
        if (activeTab !== "all") params.tab = activeTab;
        setSearchParams(params);
      }
    }
  };

  const inboxTabs = [
    { label: "All", value: "all", count: tabCounts.all },
    { label: "Unread", value: "unread", count: tabCounts.unread },
    { label: "Open", value: "open", count: tabCounts.open },
    { label: "Closed", value: "closed", count: tabCounts.closed },
  ];

  const channelEmptyStateConfig = {
    WHATSAPP: {
      title: "WhatsApp Business",
      desc: "Send and receive messages with your customers on WhatsApp. Select a conversation to get started.",
      footer: "End-to-end encrypted • Meta Cloud API",
      iconBg: "bg-[#25D366] text-white shadow-emerald-500/20",
      renderIcon: () => <FaWhatsapp className="w-10 h-10 text-white" />,
    },
    MESSENGER: {
      title: "Facebook Messenger",
      desc: "Connect with customers and manage incoming inquiries from your Facebook Pages. Select a conversation to get started.",
      footer: "Connected to Meta Messenger Platform",
      iconBg: "bg-[#0084FF] text-white shadow-blue-500/20",
      renderIcon: () => <FaFacebookMessenger className="w-10 h-10 text-white" />,
    },
    INSTAGRAM: {
      title: "Instagram Direct",
      desc: "Respond to Instagram DMs, story mentions, and customer inquiries in real time. Select a conversation to get started.",
      footer: "Connected to Instagram Graph API",
      iconBg: "bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] text-white shadow-pink-500/20",
      renderIcon: () => <FaInstagram className="w-10 h-10 text-white" />,
    },
    ALL: {
      title: "Unified Business Inbox",
      desc: "Manage customer conversations across WhatsApp, Instagram, and Facebook Messenger all in one place. Select a conversation to get started.",
      footer: "Unified Omnichannel Messaging Platform",
      iconBg: "bg-gradient-to-br from-[#075E54] to-[#128C7E] text-white shadow-teal-500/20",
      renderIcon: () => (
        <div className="flex items-center justify-center gap-2 text-white">
          <FaWhatsapp className="text-xl" />
          <FaInstagram className="text-xl" />
          <FaFacebookMessenger className="text-xl" />
        </div>
      ),
    },
  };

  const filteredContacts = allContacts
    .filter((c) => Boolean(c.phone))
    .filter((c) => {
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
      <ChatSidebar
        selectedChannel={selectedChannel}
        setShowNewChatModal={setShowNewChatModal}
        userRole={userRole}
        sidebarMenuRef={sidebarMenuRef}
        showSidebarMenu={showSidebarMenu}
        setShowSidebarMenu={setShowSidebarMenu}
        setBulkSelectMode={setBulkSelectMode}
        setShowDeleteAllConfirm={setShowDeleteAllConfirm}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        channelFilterRef={channelFilterRef}
        showChannelFilter={showChannelFilter}
        setShowChannelFilter={setShowChannelFilter}
        handleSelectChannelFilter={handleSelectChannelFilter}
        activeChannelCounts={activeChannelCounts}
        inboxTabs={inboxTabs}
        activeTab={activeTab}
        handleTabClick={handleTabClick}
        bulkSelectMode={bulkSelectMode}
        selectedConvIds={selectedConvIds}
        tabFilteredChats={tabFilteredChats}
        handleSelectAll={handleSelectAll}
        setShowBulkReassignModal={setShowBulkReassignModal}
        loading={loading}
        activeChatId={activeChatId}
        getAvatarStyle={getAvatarStyle}
        getAvatarUrl={getAvatarUrl}
        getUnreadCount={getUnreadCount}
        formatTime={formatTime}
        handleToggleConvSelection={handleToggleConvSelection}
        handleSelectChat={handleSelectChat}
        formatLastMessagePreview={formatLastMessagePreview}
        setShowArchived={setShowArchived}
        archivedChats={archivedChats}
      />
      {/* ══ End Left Sidebar ══ */}

      {/* ══════════════════════════════════════
          MIDDLE CHAT AREA
      ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <MediaStagingOverlay
          selectedFile={selectedFile}
          handleCancelFile={handleCancelFile}
          filePreview={filePreview}
          stagingEmojiPickerRef={stagingEmojiPickerRef}
          showStagingEmojiPicker={showStagingEmojiPicker}
          setShowStagingEmojiPicker={setShowStagingEmojiPicker}
          handleStagingEmojiClick={handleStagingEmojiClick}
          fileCaption={fileCaption}
          setFileCaption={setFileCaption}
          handleSendFile={handleSendFile}
          uploadingFile={uploadingFile}
        />
        {activeChat ? (
          <>
            <ChatHeader
              activeChat={activeChat}
              getAvatarUrl={getAvatarUrl}
              getAvatarStyle={getAvatarStyle}
              activeViewers={activeViewers}
              user={user}
              handleRequestCallPermission={handleRequestCallPermission}
              handleInitiateCall={handleInitiateCall}
              handleUpdateStatus={handleUpdateStatus}
              showConvMenu={showConvMenu}
              setShowConvMenu={setShowConvMenu}
              handleArchiveConversation={handleArchiveConversation}
              archivingConv={archivingConv}
              userRole={userRole}
              showDeleteConfirm={showDeleteConfirm}
              setShowDeleteConfirm={setShowDeleteConfirm}
              showContactPanel={showContactPanel}
              setShowContactPanel={setShowContactPanel}
              is24hExpired={is24hExpired}
              typingAgents={typingAgents}
              deletingConv={deletingConv}
              handleDeleteConversation={handleDeleteConversation}
              convMenuRef={convMenuRef}
            />
            <ChatFeed
              chatContainerRef={chatContainerRef}
              handleScroll={handleScroll}
              loadingMessages={loadingMessages}
              timelineItems={timelineItems}
              formatDate={formatDate}
              activeChat={activeChat}
              handleInitiateCall={handleInitiateCall}
              formatTime={formatTime}
              hoveredMessageId={hoveredMessageId}
              setHoveredMessageId={setHoveredMessageId}
              canDeleteMessage={canDeleteMessage}
              deleteConfirmId={deleteConfirmId}
              setDeleteConfirmId={setDeleteConfirmId}
              deletingMessageId={deletingMessageId}
              handleDeleteMessage={handleDeleteMessage}
              user={user}
              getMediaUrl={getMediaUrl}
              setPreviewImageModal={setPreviewImageModal}
              typingAgents={typingAgents}
              messagesEndRef={messagesEndRef}
              showScrollArrow={showScrollArrow}
              scrollToBottom={scrollToBottom}
            />
            {/* Input Bar */}
            <ChatInput
              handleSendMessage={handleSendMessage}
              activeChat={activeChat}
              handleUpdateStatus={handleUpdateStatus}
              stagedQuickReply={stagedQuickReply}
              setStagedQuickReply={setStagedQuickReply}
              emojiPickerRef={emojiPickerRef}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              handleEmojiClick={handleEmojiClick}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              documentInputRef={documentInputRef}
              photoVideoInputRef={photoVideoInputRef}
              audioInputRef={audioInputRef}
              cameraInputRef={cameraInputRef}
              attachMenuRef={attachMenuRef}
              showAttachMenu={showAttachMenu}
              setShowAttachMenu={setShowAttachMenu}
              handleAttachMenuClick={handleAttachMenuClick}
              showQuickReplyPopover={showQuickReplyPopover}
              filteredQuickReplies={filteredQuickReplies}
              quickReplySelectedIndex={quickReplySelectedIndex}
              handleSelectQuickReply={handleSelectQuickReply}
              setShowQuickReplyPopover={setShowQuickReplyPopover}
              user={user}
              typedMessage={typedMessage}
              setQuickReplySelectedIndex={setQuickReplySelectedIndex}
              setFilteredQuickReplies={setFilteredQuickReplies}
              setTypedMessage={setTypedMessage}
              quickRepliesList={quickRepliesList}
              socket={socket}
              activeChatId={activeChatId}
              isTypingRef={isTypingRef}
              typingTimeoutRef={typingTimeoutRef}
              isRecording={isRecording}
              recordingTime={recordingTime}
              handleCancelRecording={handleCancelRecording}
              handleStopRecording={handleStopRecording}
              handleStartRecording={handleStartRecording}
            />
          </>
        ) : (
          <div
            className="flex-1 flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: "#F0F2F5" }}
          >
            {(() => {
              const currentConfig =
                channelEmptyStateConfig[selectedChannel] ||
                channelEmptyStateConfig.ALL;
              return (
                <div className="bg-white rounded-3xl shadow-sm border border-emerald-100/80 p-8 md:p-10 flex flex-col items-center max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg ${currentConfig.iconBg}`}
                  >
                    {currentConfig.renderIcon()}
                  </div>
                  <h3 className="text-xl font-bold text-[#111B21] mb-1.5">
                    {currentConfig.title}
                  </h3>
                  <p className="text-xs md:text-sm text-[#667781] text-center mb-5 leading-relaxed">
                    {currentConfig.desc}
                  </p>

                  {tabFilteredChats.length === 0 && !loading && (
                    <div className="mb-4 px-3 py-2 bg-[#F0F2F5] rounded-xl text-xs text-[#54656F] flex items-center gap-2">
                      <span>No {selectedChannel !== "ALL" ? selectedChannel.toLowerCase() : ""} chats in this tab</span>
                      {selectedChannel !== "ALL" && (
                        <button
                          onClick={() => setSelectedChannel("ALL")}
                          className="text-[#075E54] font-bold hover:underline"
                        >
                          Show All
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8696A0]">
                    <svg
                      viewBox="0 0 10 10"
                      className="w-3 h-3 text-[#075E54]"
                      fill="currentColor"
                    >
                      <path d="M5 0a5 5 0 100 10A5 5 0 005 0zm.5 7.5h-1v-1h1v1zm0-2h-1v-3h1v3z" />
                    </svg>
                    <span>{currentConfig.footer}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      {/* ══ End Middle Chat Area ══ */}

           {/* ══════════════════════════════════════
          RIGHT PANEL (WhatsApp Style Info & Media)
      ══════════════════════════════════════ */}
      <ContactPanel
        activeChat={activeChat}
        showContactPanel={showContactPanel}
        setShowContactPanel={setShowContactPanel}
        rightPanelSubView={rightPanelSubView}
        setRightPanelSubView={setRightPanelSubView}
        mediaActiveTab={mediaActiveTab}
        setMediaActiveTab={setMediaActiveTab}
        mediaCategoryCounts={mediaCategoryCounts}
        mediaItems={mediaItems}
        loadingMediaItems={loadingMediaItems}
        activeChatCalls={activeChatCalls}
        loadingCalls={loadingCalls}
        userRole={userRole}
        allAgents={allAgents}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        handleAssignAgent={handleAssignAgent}
        assigningUser={assigningUser}
        allTags={allTags}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        handleAssignTag={handleAssignTag}
        assigningTag={assigningTag}
        handleRemoveTag={handleRemoveTag}
        handleTogglePin={handleTogglePin}
        getAvatarStyle={getAvatarStyle}
        getAvatarUrl={getAvatarUrl}
        getMediaUrl={getMediaUrl}
        formatDate={formatDate}
        setPreviewImageModal={setPreviewImageModal}
        activeChatId={activeChatId}
        loadConversationCalls={loadConversationCalls}
        handleInitiateCall={handleInitiateCall}
      />
      {/* ══ End Right Panel ══ */}

      <NewChatModal
        showNewChatModal={showNewChatModal}
        setShowNewChatModal={setShowNewChatModal}
        modalSearch={modalSearch}
        setModalSearch={setModalSearch}
        loadingContacts={loadingContacts}
        filteredContacts={filteredContacts}
        handleSelectContactForChat={handleSelectContactForChat}
        getAvatarStyle={getAvatarStyle}
      />
      {/* ══════════════════════════════════════
          ARCHIVED CHATS MODAL
      ══════════════════════════════════════ */}
      {showArchived && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
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

      <LocationModal
        showLocationModal={showLocationModal}
        setShowLocationModal={setShowLocationModal}
        locationForm={locationForm}
        setLocationForm={setLocationForm}
        locationError={locationError}
        setLocationError={setLocationError}
        sendingLocation={sendingLocation}
        handleSendLocation={handleSendLocation}
      />
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

      <MediaPreviewModal
        previewImageModal={previewImageModal}
        setPreviewImageModal={setPreviewImageModal}
      />
    </div>
  );
}
// src/pages/dashboard/Inbox.jsx

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  Tag,
  Clock,
  CheckCheck,
  Check,
  MoreVertical,
  MessageSquarePlus,
  X,
  Users,
  RefreshCw,
  CheckCircle2,
  Mail,
  Building2,
  CalendarDays,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import {
  getAssignedConversations,
  getConversationMessages,
  createConversation,
  updateConversationStatus,
} from "../../services/conversation.service";
import { sendMessage } from "../../services/message.service";
import { getContacts } from "../../services/contact.service";
import { useAuthStore } from "../../store/useAuthStore";
import { io } from "socket.io-client";

/* ─── WhatsApp Green Palette ───
   Primary:    #075E54  (dark teal)
   Secondary:  #128C7E  (teal)
   Light:      #25D366  (green)
   Chat BG:    #ECE5DD  (beige)
   Sent Bubble:#DCF8C6  (light green)
   Header:     #075E54
   ─────────────────────────────── */

export default function Inbox() {
  const { user } = useAuthStore();
  const userRole = user?.type === "TENANT" ? "admin" : "agent";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlConversationId = searchParams.get("conversationId");
  const filter =
    searchParams.get("filter") || (userRole === "admin" ? "all" : "my");
  const activeTab = searchParams.get("tab") || "all";

  // State
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(urlConversationId || null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});

  // Scroll
  const messagesEndRef = useRef(null);
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helpers
  const getContactTags = (contact) => {
    if (!contact) return [];
    if (Array.isArray(contact.tags)) return contact.tags;
    if (Array.isArray(contact.contactTags))
      return contact.contactTags.map((ct) => ct.tag?.name || ct.tag || "");
    return [];
  };

  const getUnreadCount = (conversationId) =>
    unreadMap[String(conversationId)] || 0;

  // New Chat Modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  const activeChat =
    chats.find((c) => String(c.id) === String(activeChatId)) || null;

  const [socket, setSocket] = useState(null);
  const activeTenantId =
    user?.type === "TENANT" ? user?.id : user?.tenantId;

  // Socket
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_BACKEND_URL;
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      if (activeTenantId) {
        newSocket.emit("join_tenant", activeTenantId);
      }
    });

    newSocket.on("new_message", (data) => {
      const { conversationId, message } = data;
      const isFromCustomer = message?.isFromCustomer === true;
      const isCurrentChatOpen =
        String(activeChatId) === String(conversationId);

      if (isCurrentChatOpen) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      if (isFromCustomer && !isCurrentChatOpen) {
        setUnreadMap((prev) => ({
          ...prev,
          [String(conversationId)]: (prev[String(conversationId)] || 0) + 1,
        }));
      }

      setChats((prevChats) => {
        const exists = prevChats.some(
          (c) => String(c.id) === String(conversationId)
        );
        if (!exists) return prevChats;

        const updated = prevChats.map((c) => {
          if (String(c.id) === String(conversationId)) {
            return {
              ...c,
              status: "OPEN",
              lastMessageAt: message.createdAt,
              updatedAt: message.createdAt,
              messages: [
                {
                  id: message.id,
                  text: message.text,
                  createdAt: message.createdAt,
                },
              ],
            };
          }
          return c;
        });

        return updated.sort((a, b) => {
          const dateA = a.messages?.[0]?.createdAt || a.updatedAt;
          const dateB = b.messages?.[0]?.createdAt || b.updatedAt;
          return new Date(dateB) - new Date(dateA);
        });
      });
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [activeTenantId]);

  // Load conversations
  const loadConversations = async () => {
    setLoading(true);
    const res = await getAssignedConversations(1, 50, filter);
    if (res.success) {
      const convList = res.data.conversations || res.data || [];
      setChats(convList);

      setUnreadMap((prev) => {
        const next = { ...prev };
        convList.forEach((c) => {
          if (next[String(c.id)] == null) next[String(c.id)] = 0;
        });
        return next;
      });

      if (!urlConversationId && convList.length > 0) {
        setActiveChatId(convList[0].id);
        setSearchParams({ filter, conversationId: convList[0].id });
      } else if (convList.length === 0) {
        setActiveChatId(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
  }, [filter]);

  useEffect(() => {
    if (urlConversationId) setActiveChatId(urlConversationId);
  }, [urlConversationId]);

  useEffect(() => {
    if (!activeChatId) return;
    setUnreadMap((prev) => ({ ...prev, [String(activeChatId)]: 0 }));
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const loadMessages = async () => {
      const res = await getConversationMessages(activeChatId, 50);
      if (res.success) setMessages(res.data.messages || []);
    };
    loadMessages();
  }, [activeChatId]);

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

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChatId || !activeChat?.contact?.id)
      return;
    const messageText = typedMessage;
    const isClosedOrResolved = ["RESOLVED", "CLOSED"].includes(
      activeChat?.status
    );
    if (isClosedOrResolved) {
      const confirmReopen = window.confirm(
        "This conversation is closed/resolved. Sending will reopen it. Proceed?"
      );
      if (!confirmReopen) return;
    }
    setTypedMessage("");
    const res = await sendMessage(activeChat.contact.id, messageText);
    if (res.success) {
      if (isClosedOrResolved) loadConversations();
    } else {
      alert("Failed to send message: " + res.message);
    }
  };

  // Start new chat
  const handleSelectContactForChat = async (contactId) => {
    const res = await createConversation(contactId);
    if (res.success) {
      setShowNewChatModal(false);
      await loadConversations();
      setActiveChatId(res.data.id);
      setSearchParams({ filter, conversationId: res.data.id });
    } else {
      alert("Could not start chat: " + res.message);
    }
  };

  // Update status
  const handleUpdateStatus = async (newStatus) => {
    if (!activeChatId) return;
    const actionText = newStatus === "OPEN" ? "reopen" : "resolve";
    const confirmChange = window.confirm(
      `Are you sure you want to ${actionText} this conversation?`
    );
    if (!confirmChange) return;
    const res = await updateConversationStatus(activeChatId, newStatus);
    if (res.success) {
      loadConversations();
      setChats((prev) =>
        prev.map((c) =>
          String(c.id) === String(activeChatId)
            ? { ...c, status: newStatus }
            : c
        )
      );
    } else {
      alert(res.message);
    }
  };

  // Avatar palette — greens & teals
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

  // Filters
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
    unread: chats.filter(
      (c) => c.status === "OPEN" && getUnreadCount(c.id) > 0
    ).length,
    open: chats.filter((c) => c.status === "OPEN").length,
    closed: chats.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED"
    ).length,
  };

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
    <div className="h-[calc(100vh-130px)] flex rounded-3xl overflow-hidden animate-in fade-in duration-200 border border-[#075E54]/10 shadow-lg shadow-[#075E54]/5">
      {/* ── Left Sidebar ── */}
      <div className="w-80 flex flex-col shrink-0 bg-white border-r border-emerald-100">
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

          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-semibold rounded-lg transition duration-150 border border-white/10 shrink-0"
            title="Start New Conversation"
          >
            <MessageSquarePlus size={13} />
            <span>New Chat</span>
          </button>
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

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-[#667781]">
                <RefreshCw size={14} className="animate-spin text-[#25D366]" />
                Loading chats...
              </div>
            </div>
          ) : (
            tabFilteredChats.map((chat) => {
              const contactName = chat.contact?.name || "Unknown Contact";
              const lastMsg = chat.messages?.[0];
              const isActive = String(chat.id) === String(activeChatId);
              const avatarBg = getAvatarStyle(contactName);
              const contactTags = getContactTags(chat.contact);
              const primaryTag = contactTags[0] || "Lead";
              const unreadCount = getUnreadCount(chat.id);
              const timeStr = lastMsg
                ? new Date(lastMsg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <button
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setSearchParams({ filter, conversationId: chat.id });
                  }}
                  className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition duration-150 border-b border-[#F0F2F5] ${
                    isActive
                      ? "bg-[#F0F2F5]"
                      : "hover:bg-[#F5F6F6] bg-white"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${avatarBg}`}
                    >
                      {contactName.charAt(0)}
                    </div>
                    {chat.status === "OPEN" && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#25D366] border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-sm truncate ${
                            unreadCount > 0
                              ? "font-bold text-[#111B21]"
                              : "font-semibold text-[#111B21]"
                          }`}
                        >
                          {contactName}
                        </span>
                        {chat.contact?.isBlocked && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0 border border-red-100">
                            Blocked
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium shrink-0 ${
                          unreadCount > 0
                            ? "text-[#25D366] font-semibold"
                            : "text-[#667781]"
                        }`}
                      >
                        {timeStr}
                      </span>
                    </div>

                    {/* Message preview + unread */}
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        {lastMsg && !lastMsg.isFromCustomer && (
                          <CheckCheck
                            size={14}
                            className="text-[#53BDEB] shrink-0"
                          />
                        )}
                        <p
                          className={`text-xs truncate max-w-[160px] ${
                            unreadCount > 0
                              ? "text-[#111B21] font-medium"
                              : "text-[#667781]"
                          }`}
                        >
                          {lastMsg ? lastMsg.text : "No messages yet"}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#25D366] text-white text-[10px] font-bold shrink-0">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Tag */}
                    <div className="mt-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border ${getTagColor(
                          primaryTag
                        )}`}
                      >
                        {primaryTag}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {!loading && tabFilteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-3">
                <FaWhatsapp className="w-7 h-7 text-[#25D366]" />
              </div>
              <p className="text-sm font-medium text-[#667781]">
                {activeTab === "unread" && "No unread chats"}
                {activeTab === "open" && "No open chats"}
                {activeTab === "closed" && "No closed chats"}
                {activeTab === "all" && "No chats found"}
              </p>
              <p className="text-[11px] text-[#8696A0] mt-1">
                Messages will appear here
              </p>
            </div>
          )}
        </div>
      </div>
      {/* ── End Left Sidebar ── */}

      {/* ── Middle Chat Area ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-[#075E54] px-5 py-3 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-white/20 ${getAvatarStyle(
                    activeChat.contact?.name
                  )}`}
                >
                  {(activeChat.contact?.name || "C").charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-none">
                    {activeChat.contact?.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
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
                <button className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Message Thread — WhatsApp wallpaper style */}
            <div
              className="flex-1 p-6 overflow-y-auto space-y-3"
              style={{
                backgroundColor: "#ECE5DD",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23075E54' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {/* Date separator */}
              {messages.length > 0 && (
                <div className="flex items-center justify-center mb-2">
                  <span className="px-4 py-1 bg-white/80 backdrop-blur-sm rounded-lg text-[10px] font-semibold text-[#54656F] shadow-sm">
                    {new Date(messages[0]?.createdAt).toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </span>
                </div>
              )}

              {messages.map((msg) => {
                const isAgent = !msg.isFromCustomer;
                const timeStr = new Date(msg.createdAt).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                );
                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      isAgent ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm text-[13px] relative ${
                        isAgent
                          ? "bg-[#D9FDD3] text-[#111B21] rounded-tr-none"
                          : "bg-white text-[#111B21] rounded-tl-none"
                      }`}
                    >
                      {/* Direction indicator */}
                      {!isAgent && (
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowDownLeft
                            size={10}
                            className="text-[#25D366]"
                          />
                          <span className="text-[9px] font-bold text-[#075E54]">
                            {activeChat.contact?.name?.split(" ")[0]}
                          </span>
                        </div>
                      )}

                      <p className="leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>

                      <div
                        className={`mt-1 flex items-center gap-1 justify-end text-[10px] text-[#667781]`}
                      >
                        <span>{timeStr}</span>
                        {isAgent && (
                          <CheckCheck size={14} className="text-[#53BDEB]" />
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
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="bg-[#F0F2F5] px-4 py-3 flex flex-col gap-2.5 shrink-0 relative z-10"
            >
              {activeChat.contact?.isBlocked && (
                <div className="flex items-center justify-between text-xs bg-red-50 text-red-800 px-4 py-2.5 rounded-xl border border-red-100 animate-in slide-in-from-bottom duration-200">
                  <span className="font-semibold">
                    This contact is blocked. You cannot send or receive
                    messages.
                  </span>
                </div>
              )}
              {["RESOLVED", "CLOSED"].includes(activeChat.status) &&
                !activeChat.contact?.isBlocked && (
                  <div className="flex items-center justify-between text-xs bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl border border-amber-100 animate-in slide-in-from-bottom duration-200">
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeChat.contact?.isBlocked}
                  className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
                >
                  <Smile size={22} />
                </button>
                <button
                  type="button"
                  disabled={activeChat.contact?.isBlocked}
                  className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
                >
                  <Paperclip size={20} className="rotate-45" />
                </button>
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
                  onChange={(e) => setTypedMessage(e.target.value)}
                  className="flex-1 py-2.5 px-4 bg-white rounded-lg border-0 text-sm text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 disabled:bg-[#F0F2F5] disabled:text-[#667781] disabled:cursor-not-allowed transition"
                />
                <button
                  type="submit"
                  disabled={activeChat.contact?.isBlocked}
                  className="w-11 h-11 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white shrink-0 flex items-center justify-center shadow-md hover:shadow-lg transition duration-150 disabled:opacity-50 disabled:hover:shadow-md"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Empty state */
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
                  className="w-3 h-3 text-[#8696A0]"
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
      {/* ── End Middle Chat Area ── */}

      {/* ── Right Panel ── */}
      {activeChat && (
        <div className="w-72 border-l border-emerald-100 flex flex-col overflow-y-auto shrink-0 bg-white">
          {/* Profile header */}
          <div className="bg-gradient-to-b from-[#075E54] to-[#128C7E] px-6 pt-6 pb-8 flex flex-col items-center text-center">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-xl ring-4 ring-white/20 shadow-lg mb-3 ${getAvatarStyle(
                activeChat.contact?.name
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
                  activeChat.status === "OPEN"
                    ? "bg-[#25D366]"
                    : "bg-[#667781]"
                }`}
              />
              <span className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">
                {activeChat.status}
              </span>
            </div>
          </div>

          {/* Info sections */}
          <div className="p-5 space-y-5">
            {/* Contact Info */}
            <div className="bg-[#F0F2F5] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-[#075E54] text-xs font-bold uppercase tracking-wider">
                <Phone size={13} />
                <span>Contact Info</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-[#25D366] shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#667781] font-medium">
                      Phone
                    </p>
                    <p className="text-xs font-semibold text-[#111B21]">
                      {activeChat.contact?.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail size={14} className="text-[#25D366] shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#667781] font-medium">
                      Email
                    </p>
                    <p className="text-xs font-semibold text-[#111B21]">
                      {activeChat.contact?.email || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Building2 size={14} className="text-[#25D366] shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#667781] font-medium">
                      Company
                    </p>
                    <p className="text-xs font-semibold text-[#111B21]">
                      {activeChat.contact?.company || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center gap-2 text-[#075E54] text-xs font-bold uppercase tracking-wider mb-2.5">
                <Tag size={13} />
                <span>Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getContactTags(activeChat.contact).map((tag, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold border ${getTagColor(
                      tag
                    )}`}
                  >
                    {tag}
                  </span>
                ))}
                {getContactTags(activeChat.contact).length === 0 && (
                  <span className="text-xs text-[#667781] italic">
                    No tags
                  </span>
                )}
              </div>
            </div>

            {/* Session Log */}
            <div>
              <div className="flex items-center gap-2 text-[#075E54] text-xs font-bold uppercase tracking-wider mb-2.5">
                <CalendarDays size={13} />
                <span>Session Log</span>
              </div>
              <div className="space-y-2 bg-[#F0F2F5] rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#667781] font-medium">
                    Created
                  </span>
                  <span className="text-[11px] text-[#111B21] font-semibold">
                    {new Date(activeChat.createdAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </span>
                </div>
                <div className="h-px bg-emerald-100" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#667781] font-medium">
                    Last Activity
                  </span>
                  <span className="text-[11px] text-[#111B21] font-semibold">
                    {new Date(activeChat.updatedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── End Right Panel ── */}

      {/* ── New Chat Modal ── */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal header */}
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
              {/* Search */}
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

              {/* Contact list */}
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
                          contact.name
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
      {/* ── End New Chat Modal ── */}
    </div>
  );
}
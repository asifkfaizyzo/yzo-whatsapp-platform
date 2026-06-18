// src/pages/dashboard/Inbox.jsx

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  Tag,
  Clock,
  Check,
  CheckCheck,
  MoreVertical,
  MessageSquarePlus,
  X,
  Users,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import {
  getAssignedConversations,
  getConversationMessages,
  createConversation,
  updateConversationStatus
} from "../../services/conversation.service";
import { sendMessage } from "../../services/message.service";
import { getContacts } from "../../services/contact.service";
import { useAuthStore } from "../../store/useAuthStore";

export default function Inbox() {
  const { user } = useAuthStore();
  const userRole = user?.type === "TENANT" ? "admin" : "agent";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlConversationId = searchParams.get("conversationId");
  const filter = searchParams.get("filter") || (userRole === "admin" ? "all" : "my");

  // State Management
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(urlConversationId || null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Safe helper to extract tag names as strings
  const getContactTags = (contact) => {
    if (!contact) return [];
    if (Array.isArray(contact.tags)) return contact.tags;
    if (Array.isArray(contact.contactTags)) {
      return contact.contactTags.map(ct => ct.tag?.name || ct.tag || "");
    }
    return [];
  };

  // New Chat Modal States
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Derive currently active chat details from chats list
  const activeChat = chats.find((c) => String(c.id) === String(activeChatId)) || null;

  // 1. Fetch conversations on component mount or filter change
  const loadConversations = async () => {
    setLoading(true);
    const res = await getAssignedConversations(1, 50, filter);
    if (res.success) {
      const convList = res.data.conversations || res.data || [];
      setChats(convList);

      // If there's no conversation selected via URL but there are chats, select the first one
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

  // 2. React to URL query parameters
  useEffect(() => {
    if (urlConversationId) {
      setActiveChatId(urlConversationId);
    }
  }, [urlConversationId]);

  // 3. Fetch messages whenever the active conversation changes
  useEffect(() => {
    if (!activeChatId) return;

    const loadMessages = async () => {
      const res = await getConversationMessages(activeChatId, 50);
      if (res.success) {
        setMessages(res.data.messages || []);
      }
    };
    loadMessages();
  }, [activeChatId]);

  // 4. Load contacts list when New Chat modal opens
  useEffect(() => {
    if (showNewChatModal) {
      const loadContacts = async () => {
        setLoadingContacts(true);
        const res = await getContacts(1, 100);
        if (res.success) {
          setAllContacts(res.data.contacts || []);
        }
        setLoadingContacts(false);
      };
      loadContacts();
    }
  }, [showNewChatModal]);

  // 5. Send message handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChatId || !activeChat?.contact?.id) return;

    const messageText = typedMessage;
    const isClosedOrResolved = ["RESOLVED", "CLOSED"].includes(activeChat?.status);

    // ⚠️ Ask for confirmation if reopening via sending a message
    if (isClosedOrResolved) {
      const confirmReopen = window.confirm("This conversation is currently closed/resolved. Sending this message will reopen it. Do you want to proceed?");
      if (!confirmReopen) return;
    }

    setTypedMessage(""); // Clear input immediately for smooth UX

    const res = await sendMessage(activeChat.contact.id, messageText);
    if (res.success) {
      // Append the sent message locally
      setMessages((prev) => [...prev, res.data]);

      // Update the status and last message preview in the sidebar
      setChats((prevChats) =>
        prevChats.map((c) =>
          String(c.id) === String(activeChatId)
            ? {
              ...c,
              status: "OPEN",
              messages: [{ id: res.data.id, text: messageText, createdAt: new Date().toISOString() }]
            }
            : c
        )
      );

      // If the chat was closed/resolved, sync with filters
      if (isClosedOrResolved) {
        loadConversations();
      }
    } else {
      alert("Failed to send message: " + res.message);
    }
  };

  // Start new chat with a contact from the modal selection
  const handleSelectContactForChat = async (contactId) => {
    const res = await createConversation(contactId);
    if (res.success) {
      setShowNewChatModal(false);
      // Reload conversation list to fetch any new entry
      await loadConversations();
      // Select the conversation in state and query param
      setActiveChatId(res.data.id);
      setSearchParams({ filter, conversationId: res.data.id });
    } else {
      alert("Could not start chat: " + res.message);
    }
  };

  // Helper styles
  const getAvatarStyle = (name) => {
    const chars = name ? name.charCodeAt(0) : 0;
    const colors = [
      "bg-emerald-100 text-emerald-800",
      "bg-blue-100 text-blue-800",
      "bg-purple-100 text-purple-800",
      "bg-amber-100 text-amber-800",
      "bg-rose-100 text-rose-800",
    ];
    return colors[chars % colors.length];
  };

  const getTagColor = (tag) => {
    if (tag === "Enterprise") return "bg-purple-50 text-purple-700 border-purple-100";
    if (tag === "Interested in pricing") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (tag === "VIP") return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-blue-50 text-blue-700 border-blue-100";
  };

  // Filter conversations in sidebar
  const filteredChats = chats.filter((c) => {
    const name = c.contact?.name || "";
    const phone = c.contact?.phone || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery)
    );
  });

  // Filter contacts inside New Chat modal
  const filteredContacts = allContacts.filter((c) => {
    const name = c.name || "";
    const phone = c.phone || "";
    return (
      name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      phone.includes(modalSearch)
    );
  });

  const handleUpdateStatus = async (newStatus) => {
    if (!activeChatId) return;

    // ⚠️ Ask for confirmation
    const actionText = newStatus === "OPEN" ? "reopen" : "resolve";
    const confirmChange = window.confirm(`Are you sure you want to ${actionText} this conversation?`);
    if (!confirmChange) return;

    const res = await updateConversationStatus(activeChatId, newStatus);
    if (res.success) {
      // Refresh conversations list to update sidebar lists according to current filter
      loadConversations();

      // Update local active chat status so UI updates immediately
      setChats((prevChats) =>
        prevChats.map((c) =>
          String(c.id) === String(activeChatId)
            ? { ...c, status: newStatus }
            : c
        )
      );
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="h-[calc(100vh-130px)] flex border border-slate-100 rounded-3xl bg-white shadow-sm overflow-hidden animate-in fade-in duration-200">

      {/* ── Left Sidebar (Conversations List) ── */}
      <div className="w-80 border-r border-slate-100 flex flex-col shrink-0">

        {/* Sidebar Header & Search */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search chat or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 py-2 text-xs"
            />
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition border border-emerald-100 shrink-0"
            title="Start New Conversation"
          >
            <MessageSquarePlus size={16} />
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading chats...</div>
          ) : filteredChats.map((chat) => {
            const contactName = chat.contact?.name || "Unknown Contact";
            const lastMsg = chat.messages?.[0]; // backend sorts latest first
            const isActive = String(chat.id) === String(activeChatId);
            const avatarBg = getAvatarStyle(contactName);
            const contactTags = getContactTags(chat.contact);
            const primaryTag = contactTags[0] || "Lead";

            const timeStr = lastMsg
              ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";

            return (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setSearchParams({ filter, conversationId: chat.id });
                }}
                className={`w-full text-left p-4 flex items-start gap-3.5 transition duration-150 ${isActive ? "bg-slate-50" : "hover:bg-slate-50/40"
                  }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avatarBg}`}>
                  {contactName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-slate-800 text-sm truncate">{contactName}</span>
                      {chat.contact?.isBlocked && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0 border border-red-100">
                          Blocked
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{timeStr}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">
                    {lastMsg ? lastMsg.text : "No messages yet"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border ${getTagColor(primaryTag)}`}>
                      {primaryTag}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && filteredChats.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">No chats found</p>
          )}
        </div>
      </div>

      {/* ── Middle Chat Area ── */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white px-6 py-3 border-b border-slate-100 flex items-center justify-between relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarStyle(activeChat.contact?.name)}`}>
                  {(activeChat.contact?.name || "C").charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-none">{activeChat.contact?.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{activeChat.contact?.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeChat.status === "OPEN" ? (
                  <button
                    onClick={() => handleUpdateStatus("RESOLVED")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-55/10 hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold transition duration-150"
                    title="Mark as Resolved"
                  >
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Resolve</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus("OPEN")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-55/10 hover:bg-blue-50 border border-blue-100 hover:border-blue-200 rounded-xl text-blue-700 text-xs font-semibold transition duration-150"
                    title="Reopen conversation"
                  >
                    <RefreshCw size={13} className="text-blue-600 animate-spin-hover" />
                    <span>Reopen</span>
                  </button>
                )}

                <button className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-50">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((msg) => {
                const isAgent = !msg.isFromCustomer;
                const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm border flex flex-col ${isAgent
                      ? "bg-emerald-600 border-emerald-700 text-white rounded-tr-none"
                      : "bg-white border-slate-100 text-slate-800 rounded-tl-none"
                      }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <div className={`mt-1 flex items-center gap-1 self-end text-[10px] ${isAgent ? "text-emerald-100" : "text-slate-400"
                        }`}>
                        <span>{timeStr}</span>
                        {isAgent && <CheckCheck size={12} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="text-center text-xs text-slate-400 my-12">No messages in this chat yet.</p>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="bg-white p-4 border-t border-slate-100 flex flex-col gap-3 shrink-0 relative z-10">
              {activeChat.contact?.isBlocked && (
                <div className="flex items-center justify-between text-xs bg-red-50 text-red-800 px-4 py-2.5 rounded-xl border border-red-100 animate-in slide-in-from-bottom duration-200">
                  <span className="font-semibold">
                    This contact is blocked. You cannot send or receive messages.
                  </span>
                </div>
              )}
              {["RESOLVED", "CLOSED"].includes(activeChat.status) && !activeChat.contact?.isBlocked && (
                <div className="flex items-center justify-between text-xs bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl border border-amber-100 animate-in slide-in-from-bottom duration-200">
                  <span className="font-semibold">
                    This conversation is currently marked as <strong className="capitalize">{activeChat.status.toLowerCase()}</strong>. Sending a message will automatically reopen it.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("OPEN")}
                    className="text-amber-900 font-bold hover:underline px-2 py-0.5 rounded-md hover:bg-amber-100 transition"
                  >
                    Reopen Chat
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button type="button" disabled={activeChat.contact?.isBlocked} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-50">
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  placeholder={activeChat.contact?.isBlocked ? "Cannot send messages to a blocked contact" : ["RESOLVED", "CLOSED"].includes(activeChat.status) ? "Type a message to reopen chat..." : "Type a message..."}
                  value={typedMessage}
                  disabled={activeChat.contact?.isBlocked}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  className="input py-2 px-4 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <button type="button" disabled={activeChat.contact?.isBlocked} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-50">
                  <Smile size={18} />
                </button>
                <button type="submit" disabled={activeChat.contact?.isBlocked} className="btn-primary w-11 h-11 p-0 rounded-xl shrink-0 flex items-center justify-center shadow-sm disabled:opacity-50">
                  <Send size={16} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
            <Users size={40} className="stroke-[1.5] mb-2 text-slate-300" />
            <p className="text-sm font-medium">Select a contact to begin messaging.</p>
          </div>
        )}
      </div>

      {/* ── Right Panel (Contact Detail Context) ── */}
      {activeChat && (
        <div className="w-72 border-l border-slate-100 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 bg-white">
          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg mb-3 ${getAvatarStyle(activeChat.contact?.name)}`}>
              {(activeChat.contact?.name || "C").charAt(0)}
            </div>
            <h3 className="font-bold text-slate-800 text-base leading-none">{activeChat.contact?.name}</h3>
            <p className="text-xs text-slate-400 mt-1">{activeChat.contact?.phone}</p>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Phone size={13} />
                <span>Contact Info</span>
              </div>
              <p className="text-xs font-semibold text-slate-700">Phone: <span className="font-medium text-slate-600">{activeChat.contact?.phone}</span></p>
              <p className="text-xs font-semibold text-slate-700 mt-1">Email: <span className="font-medium text-slate-600">{activeChat.contact?.email || "N/A"}</span></p>
              <p className="text-xs font-semibold text-slate-700 mt-1">Company: <span className="font-medium text-slate-600">{activeChat.contact?.company || "N/A"}</span></p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Tag size={13} />
                <span>Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getContactTags(activeChat.contact).map((tag, i) => (
                  <span key={i} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getTagColor(tag)}`}>
                    {tag}
                  </span>
                ))}
                {getContactTags(activeChat.contact).length === 0 && (
                  <span className="text-xs text-slate-400 italic">No tags</span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Clock size={13} />
                <span>Session Log</span>
              </div>
              <p className="text-xs text-slate-600">Created: <span className="text-slate-500">{new Date(activeChat.createdAt).toLocaleDateString()}</span></p>
              <p className="text-xs text-slate-600 mt-1">Last Interaction: <span className="text-slate-500">{new Date(activeChat.updatedAt).toLocaleDateString()}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── New Chat Modal (Inbox-Centric Flow) ── */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Start a New Chat</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col gap-4 max-h-[400px] overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="input pl-9 py-1.5 text-xs"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {loadingContacts ? (
                  <div className="text-center text-xs text-slate-400 py-6">Loading contacts...</div>
                ) : filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContactForChat(contact.id)}
                    className="w-full text-left py-2.5 px-2 hover:bg-slate-50 transition flex items-center gap-3 rounded-xl"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarStyle(contact.name)}`}>
                      {contact.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-850 truncate">{contact.name}</p>
                        {contact.isBlocked && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0 border border-red-100">
                            Blocked
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{contact.phone}</p>
                    </div>
                  </button>
                ))}

                {!loadingContacts && filteredContacts.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-6">No matching contacts found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// src/pages/dashboard/Inbox.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
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
} from "../../services/conversation.service";
import { sendMessage, sendMediaMessage, deleteMessage } from "../../services/message.service";
import {
  getContacts,
  addTagToContact,
  removeTagFromContact,
} from "../../services/contact.service";
import { useAuthStore } from "../../store/useAuthStore";
import { io } from "socket.io-client";
import { getTags } from "../../services/tag.service";
import {
  getTenantUsers,
  assignContact,
} from "../../services/tenant.service";
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

  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    const chatContainer = messagesEndRef.current.parentElement;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

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

  // ── Delete Message State ──
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

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

  // ── Helpers ──
  const getContactTags = (contact) => {
    if (!contact) return [];
    if (Array.isArray(contact.tags)) return contact.tags;
    if (Array.isArray(contact.contactTags))
      return contact.contactTags.map((ct) => ct.tag?.name || ct.tag || "");
    return [];
  };

  const getUnreadCount = (conversationId) =>
    unreadMap[String(conversationId)] || 0;

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

        if (!urlConversationId && convList.length > 0) {
          setActiveChatId(convList[0].id);
          setSearchParams({ filter, conversationId: convList[0].id });
        } else if (convList.length === 0) {
          setActiveChatId(null);
        }
      }
      if (!silent) setLoading(false);
    },
    [filter, urlConversationId, setSearchParams]
  );

  // ── Initial Load ──
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Sync URL param → activeChatId ──
  useEffect(() => {
    if (urlConversationId) setActiveChatId(urlConversationId);
  }, [urlConversationId]);

  // ── Clear unread when chat opened ──
  useEffect(() => {
    if (!activeChatId) return;
    setUnreadMap((prev) => ({ ...prev, [String(activeChatId)]: 0 }));
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
      if (res.success) setMessages(res.data.messages || []);
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
      console.log("🔌 Inbox Socket Connected:", newSocket.id);

      // Always join tenant room (needed for new_message events for everyone)
      if (activeTenantId) {
        newSocket.emit("join_tenant", activeTenantId);
        console.log("👥 Inbox joined tenant room:", activeTenantId);
      }

      // FIXED: If USER (agent), also join personal user room
      // This ensures new_notification events from emitToUser() are received
      if (user?.type === "USER" && user?.id) {
        newSocket.emit("join_user", user.id);
        console.log("👤 Inbox joined user room:", user.id);
      }
    });

    setSocket(newSocket);

    return () => {
      console.log("🔌 Inbox Socket Disconnecting");
      newSocket.disconnect();
    };
  // FIXED: Added user?.id and user?.type to dependency array
  }, [activeTenantId, accessToken, user?.id, user?.type]);

  // ── Socket Event Listeners ──
  useEffect(() => {
    if (!socket) return;

    // ── Handle new message ──
    const handleNewMessage = (data) => {
      const { conversationId, message } = data;
      const isFromCustomer = message?.isFromCustomer === true;
      const isCurrentChatOpen =
        activeChatId && String(activeChatId) === String(conversationId);

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
        if (!exists) {
          setTimeout(() => {
            loadConversations(true);
          }, 0);
          return prevChats;
        }

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
    };

    // ── Handle deleted message ──
    const handleMessageDeleted = ({ messageId, conversationId: convId }) => {
      console.log("🗑️ message_deleted received:", messageId);

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
            : m
        )
      );

      setChats((prevChats) =>
        prevChats.map((c) => {
          if (String(c.id) === String(convId)) {
            return {
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === messageId
                  ? { ...m, text: "🚫 Message deleted", isDeleted: true }
                  : m
              ),
            };
          }
          return c;
        })
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
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
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");

    const maxSize = isImage
      ? 5 * 1024 * 1024
      : isVideo || isAudio
      ? 16 * 1024 * 1024
      : 100 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.warning(
        `File too large. Max size is ${
          isImage ? "5MB" : isVideo || isAudio ? "16MB" : "100MB"
        }`
      );
      return;
    }

    setSelectedFile(file);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }

    e.target.value = "";
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
      activeChat?.status
    );

    if (isClosedOrResolved) {
      const ok = await confirm({
        type: "info",
        title: "Reopen Conversation?",
        message: "This conversation is closed/resolved. Sending will reopen it. Proceed?",
        confirmLabel: "Send & Reopen",
      });
      if (!ok) return;
    }

    setTypedMessage("");
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
              : m
          )
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
            : c
        )
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
          prev.filter((c) => String(c.id) !== String(activeChatId))
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
          prev.filter((c) => String(c.id) !== String(activeChatId))
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
                (ct) => ct.tag?.id === selectedTag
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
          })
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
                    (ct) => ct.tag?.id !== tagId
                  ),
                },
              };
            }
            return c;
          })
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
          })
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
        res.data?.conversations ||
        res.data?.data?.conversations ||
        [];
      setArchivedChats(list);
    }
    setLoadingArchived(false);
  };

  // ── Unarchive Handler ──
  const handleUnarchiveConversation = async (conversationId) => {
    setUnarchivingId(conversationId);
    try {
      const res = await unarchiveConversation(conversationId);
      if (res.success) {
        setArchivedChats((prev) =>
          prev.filter((c) => String(c.id) !== String(conversationId))
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
    unread: chats.filter(
      (c) => c.status === "OPEN" && getUnreadCount(c.id) > 0
    ).length,
    open: chats.filter((c) => c.status === "OPEN").length,
    closed: chats.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED"
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
            <Search className="absolute left-3 top-2.5 text-[#54656F]" size={14} />
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
                    isActive ? "bg-[#F0F2F5]" : "hover:bg-[#F5F6F6] bg-white"
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

                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        {lastMsg && !lastMsg.isFromCustomer && (
                          <CheckCheck size={14} className="text-[#53BDEB] shrink-0" />
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

        {/* Archived Button */}
        <div className="px-3 py-2 border-t border-emerald-100 shrink-0">
          <button
            onClick={() => setShowArchived(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#667781] hover:text-[#075E54] hover:bg-[#F0F2F5] rounded-xl transition duration-150"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <span>Archived Chats</span>
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
                          <RefreshCw size={14} className="animate-spin text-[#075E54]" />
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
              </div>
            </div>

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
                      ⚠️ This will permanently delete all messages and cannot be undone.
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
                    {new Date(messages[0]?.createdAt).toLocaleDateString(
                      undefined,
                      { weekday: "long", month: "short", day: "numeric" }
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

                const BACKEND_URL =
                  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

                const getMediaUrl = (mediaUrl) => {
                  if (!mediaUrl) return "";
                  if (
                    mediaUrl.startsWith("http://") ||
                    mediaUrl.startsWith("https://")
                  ) {
                    return mediaUrl;
                  }
                  return `${BACKEND_URL}${mediaUrl}`;
                };

                // ── DELETED MESSAGE UI ──
                if (msg.isDeleted) {
                  return (
                    <div
                      key={msg.id}
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
                    key={msg.id}
                    className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
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
                                deleteConfirmId === msg.id ? null : msg.id
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
                                    <RefreshCw size={10} className="animate-spin" />
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
                                  deleteConfirmId === msg.id ? null : msg.id
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
                                      <RefreshCw size={10} className="animate-spin" />
                                    ) : (
                                      "Delete"
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* TEXT */}
                      {(msg.type === "TEXT" || (!msg.type && msg.text)) && (
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}

                      {/* IMAGE */}
                      {msg.type === "IMAGE" && msg.mediaUrl && (
                        <div className="mb-1">
                          <img
                            src={getMediaUrl(msg.mediaUrl)}
                            alt={msg.mediaName || "image"}
                            className="rounded-lg max-w-full"
                            style={{
                              maxWidth: "220px",
                              maxHeight: "200px",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          {msg.caption && (
                            <p className="text-xs mt-1 text-[#111B21]">
                              {msg.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {/* FILE */}
                      {msg.type === "FILE" && msg.mediaUrl && (
                        <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg mb-1 min-w-[180px]">
                          <div className="w-9 h-9 rounded-lg bg-[#075E54]/10 flex items-center justify-center shrink-0">
                            <Paperclip size={16} className="text-[#075E54]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#111B21] truncate">
                              {msg.mediaName || "File"}
                            </p>
                            <p className="text-[9px] text-[#667781]">
                              {msg.mediaSize
                                ? msg.mediaSize < 1024 * 1024
                                  ? (msg.mediaSize / 1024).toFixed(1) + " KB"
                                  : (msg.mediaSize / (1024 * 1024)).toFixed(1) + " MB"
                                : ""}
                            </p>
                            {msg.caption && (
                              <p className="text-[10px] text-[#111B21] mt-0.5">
                                {msg.caption}
                              </p>
                            )}
                          </div>
                          <a
                            href={getMediaUrl(msg.mediaUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={msg.mediaName}
                            className="text-[#075E54] hover:text-[#064E47] transition shrink-0"
                            title="Download"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </a>
                        </div>
                      )}

                      {/* VIDEO */}
                      {msg.type === "VIDEO" && msg.mediaUrl && (
                        <div className="mb-1">
                          <video
                            src={getMediaUrl(msg.mediaUrl)}
                            controls
                            className="rounded-lg"
                            style={{ maxWidth: "220px" }}
                          />
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

                      {/* Time + Ticks */}
                      <div className="mt-1 flex items-center gap-1 justify-end text-[10px] text-[#667781]">
                        <span>{timeStr}</span>
                        {isAgent && (
                          <>
                            {msg.status === "sent" && (
                              <Check size={14} className="text-[#667781]" />
                            )}
                            {msg.status === "delivered" && (
                              <CheckCheck size={14} className="text-[#667781]" />
                            )}
                            {(msg.status === "read" || msg.isRead) && (
                              <CheckCheck size={14} className="text-[#53BDEB]" />
                            )}
                            {!msg.status && !msg.isRead && (
                              <CheckCheck size={14} className="text-[#667781]" />
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
                    This contact is blocked. You cannot send or receive messages.
                  </span>
                </div>
              )}
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
                        : (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB"}
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
                <button
                  type="button"
                  disabled={activeChat.contact?.isBlocked}
                  className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
                >
                  <Smile size={22} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,video/mp4,audio/mpeg,audio/ogg"
                  onChange={handleFileSelect}
                />

                <button
                  type="button"
                  disabled={activeChat.contact?.isBlocked}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
                >
                  <Paperclip size={20} className="rotate-45" />
                </button>

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
                    onChange={(e) => setTypedMessage(e.target.value)}
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
                <svg viewBox="0 0 10 10" className="w-3 h-3" fill="currentColor">
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
        <div className="w-72 border-l border-emerald-100 flex flex-col overflow-y-auto shrink-0 bg-white">

          {/* Profile Header */}
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
                  {activeChat.contact?.assignedTo
                    ? allAgents.find(
                        (a) => a.id === activeChat.contact?.assignedTo
                      )?.name || "Assigned"
                    : (
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
                      ct.tag?.name
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
                  {new Date(activeChat.createdAt).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </span>
              </div>
              <div className="h-px bg-emerald-100" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#667781]">Last Activity</span>
                <span className="text-[10px] text-[#111B21] font-semibold">
                  {new Date(activeChat.updatedAt).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
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
                archivedChats.map((chat) => {
                  const contactName = chat.contact?.name || "Unknown";
                  const lastMsg = chat.messages?.[0];
                  const isUnarchiving = unarchivingId === chat.id;
                  const archivedDate = chat.archivedAt
                    ? new Date(chat.archivedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "";

                  return (
                    <div
                      key={chat.id}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5F6F6] transition"
                    >
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarStyle(
                          contactName
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
                          {lastMsg?.text || "No messages"}
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

    </div>
  );
}
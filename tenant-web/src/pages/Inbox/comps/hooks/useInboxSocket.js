// tenant-web/src/pages/Inbox/comps/hooks/useInboxSocket.js (do not remove this comment)

import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import api from "../../../../api/axios";
import { useAuthStore } from "../../../../store/useAuthStore";
import { useToast } from "../../../../context/ToastContext";

/**
 * Manages the Socket.io connection, room joins, presence (viewers/typing),
 * and all 11 real-time event listeners.
 *
 * State setters are passed in because the socket mutates state owned by
 * other hooks (conversations, messages, unread, calls). The parent page
 * component wires them together.
 *
 * @param {object}   opts
 * @param {string}   opts.activeChatId
 * @param {Function} opts.setChats            - from useInboxConversations
 * @param {Function} opts.setMessages         - from useInboxMessages
 * @param {Function} opts.setUnreadMap        - from useInboxMessages
 * @param {Function} opts.setActiveChatCalls  - from useInboxCalls
 * @param {Function} opts.loadConversations   - from useInboxConversations (must be useCallback-stable)
 * @param {Function} opts.loadConversationCalls - from useInboxCalls (must be useCallback-stable)
 * @param {Function} opts.scrollToBottom      - ref-based scroll helper from page
 */
export const useInboxSocket = ({
  activeChatId,
  setChats,
  setMessages,
  setUnreadMap,
  setActiveChatCalls,
  loadConversations,
  loadConversationCalls,
  scrollToBottom,
}) => {
  const { user, accessToken } = useAuthStore();
  const toast = useToast();

  const [socket, setSocket] = useState(null);
  const [activeViewers, setActiveViewers] = useState([]);
  const [typingAgents, setTypingAgents] = useState([]);
  const prevChatIdRef = useRef(null);

  const activeTenantId =
    user?.type === "TENANT" ? user?.id : user?.tenantId;

  // ── Socket Connection ──
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_BACKEND_URL;
    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      if (activeTenantId) newSocket.emit("join_tenant", activeTenantId);
      if (user?.type === "USER" && user?.id)
        newSocket.emit("join_user", user.id);
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [activeTenantId, accessToken, user?.id, user?.type]);

  // ── Refresh conversations/messages after reconnect ──
  useEffect(() => {
    if (!socket) return;
    const refreshAfterConnect = async () => {
      await loadConversations(true);
    };
    socket.on("connect", refreshAfterConnect);
    if (socket.connected) refreshAfterConnect();
    return () => socket.off("connect", refreshAfterConnect);
  }, [socket, loadConversations]);

  // ── Conversation Presence & Typing ──
  useEffect(() => {
    if (!socket) return;

    if (
      prevChatIdRef.current &&
      String(prevChatIdRef.current) !== String(activeChatId)
    ) {
      socket.emit("leave_conversation", {
        conversationId: prevChatIdRef.current,
      });
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
      if (
        activeChatId &&
        String(data.conversationId) === String(activeChatId)
      ) {
        setActiveViewers(data.viewers || []);
      }
    };
    const handleTypingUpdated = (data) => {
      if (
        activeChatId &&
        String(data.conversationId) === String(activeChatId)
      ) {
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

  // ── Main Event Listeners (11 events) ──
  useEffect(() => {
    if (!socket) return;

    // ── new_message ──
    const handleNewMessage = (data) => {
      const { conversationId, message } = data;
      if (!message || typeof message !== "object" || !message.id) return;

      const isFromCustomer =
        message?.isFromCustomer === true || message?.direction === "INBOUND";
      const isCurrentChatOpen =
        activeChatId && String(activeChatId) === String(conversationId);

      if (isCurrentChatOpen) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        if (scrollToBottom) setTimeout(() => scrollToBottom(true), 50);

        if (isFromCustomer) {
          setUnreadMap((prev) => ({
            ...prev,
            [String(conversationId)]: 0,
          }));
          setChats((prev) =>
            prev.map((c) =>
              String(c.id) === String(conversationId)
                ? { ...c, unreadCount: 0 }
                : c,
            ),
          );
          api
            .patch(
              `${import.meta.env.VITE_BACKEND_URL}/tenant/conversations/mark-read/${conversationId}`,
            )
            .catch((err) => console.error("Mark read failed:", err));
        }
      }

      if (isFromCustomer && !isCurrentChatOpen) {
        setUnreadMap((prev) => ({
          ...prev,
          [String(conversationId)]:
            (prev[String(conversationId)] || 0) + 1,
        }));
      }

      setChats((prevChats) => {
        const exists = prevChats.some(
          (c) => String(c.id) === String(conversationId),
        );
        if (!exists) {
          setTimeout(() => loadConversations(true), 0);
          return prevChats;
        }

        const currentChat = prevChats.find(
          (c) => String(c.id) === String(conversationId),
        );
        const currentLatestMsgId = currentChat?.messages?.[0]?.id;
        const currentLatestTime = currentChat?.messages?.[0]?.createdAt
          ? new Date(currentChat.messages[0].createdAt).getTime()
          : 0;
        const newMessageTime = message.createdAt
          ? new Date(message.createdAt).getTime()
          : Date.now();

        if (
          currentLatestMsgId === message.id ||
          newMessageTime < currentLatestTime
        ) {
          return prevChats;
        }

        const msgCreatedAt = message.createdAt || new Date().toISOString();
        const isCustomerMsg =
          message?.isFromCustomer === true ||
          message?.direction === "INBOUND";

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

    // ── message_deleted ──
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
                  ? { ...m, text: "Message deleted", isDeleted: true }
                  : m,
              ),
            };
          }
          return c;
        }),
      );
    };

    // ── conversations_reassigned ──
    const handleConversationsReassigned = (data) => {
      const { conversationIds, newUserId } = data;
      setChats((prev) =>
        prev.map((c) =>
          conversationIds.includes(c.id)
            ? { ...c, contact: { ...c.contact, assignedTo: newUserId } }
            : c,
        ),
      );
    };

    // ── unread_count_update ──
    const handleUnreadCountUpdate = (data) => {
      const { conversationId, unreadCount } = data;
      const isCurrentChatOpen =
        activeChatId && String(activeChatId) === String(conversationId);

      if (isCurrentChatOpen) {
        setChats((prev) =>
          prev.map((c) =>
            String(c.id) === String(conversationId)
              ? { ...c, unreadCount: 0 }
              : c,
          ),
        );
        setUnreadMap((prev) => ({
          ...prev,
          [String(conversationId)]: 0,
        }));
        return;
      }

      setChats((prev) =>
        prev.map((c) =>
          String(c.id) === String(conversationId)
            ? { ...c, unreadCount }
            : c,
        ),
      );
    };

    // ── conversation_assigned ──
    const handleConversationAssigned = (data) => {
      if (!data.conversation) return;
      setChats((prev) => {
        const exists = prev.some(
          (c) => String(c.id) === String(data.conversation.id),
        );
        if (exists) return prev;
        const updated = [data.conversation, ...prev];
        return updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return b.isPinned ? -1 : 1;
          if (a.isPinned && b.isPinned) {
            return new Date(b.pinnedAt) - new Date(a.pinnedAt);
          }
          return (
            new Date(
              b.lastActivityAt || b.updatedAt || b.createdAt,
            ) -
            new Date(a.lastActivityAt || a.updatedAt || a.createdAt)
          );
        });
      });
    };

    // ── message_status_update (tick marks) ──
    const handleMessageStatusUpdate = (data) => {
      const { messageId, wamid, status } = data;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId || (wamid && m.wamid === wamid)) {
            return {
              ...m,
              status,
              isRead: status === "read" ? true : m.isRead,
            };
          }
          return m;
        }),
      );
    };

    // ── channel_error ──
    const handleChannelError = (data) => {
      toast.error(`Channel Error (${data.channel}): ${data.error}`);
    };

    // ── call_status_update ──
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

    // ── call_recording_ready ──
    const handleCallRecordingReady = (data) => {
      if (!data?.wacid) return;
      setActiveChatCalls((prev) => {
        if (!prev.some((c) => c.wacid === data.wacid)) {
          if (activeChatId) loadConversationCalls(activeChatId);
          return prev;
        }
        return prev.map((c) => {
          if (c.wacid === data.wacid) {
            const recs = c.recordings || [];
            const newRec = data.recording || {
              mediaUrl: data.mediaUrl,
              downloadStatus: "DOWNLOADED",
            };
            return {
              ...c,
              recordings: [
                ...recs.filter(
                  (r) =>
                    r.id !== newRec.id && r.mediaUrl !== newRec.mediaUrl,
                ),
                newRec,
              ],
            };
          }
          return c;
        });
      });
    };

    // ── call_transcript_ready ──
    const handleCallTranscriptReady = (data) => {
      if (!data?.wacid) return;
      setActiveChatCalls((prev) => {
        if (!prev.some((c) => c.wacid === data.wacid)) {
          if (activeChatId) loadConversationCalls(activeChatId);
          return prev;
        }
        return prev.map((c) => {
          if (c.wacid === data.wacid) {
            const trans = c.transcripts || [];
            const newTrans = data.transcript || {
              fullText: data.fullText,
              mediaUrl: data.mediaUrl,
              downloadStatus: "DOWNLOADED",
            };
            return {
              ...c,
              transcripts: [
                ...trans.filter(
                  (t) =>
                    t.id !== newTrans.id &&
                    t.mediaUrl !== newTrans.mediaUrl,
                ),
                newTrans,
              ],
            };
          }
          return c;
        });
      });
    };

    // ── conversations_updated ──
    const handleConversationsUpdated = () => loadConversations(true);

    // Register all
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
  }, [
    socket,
    activeChatId,
    loadConversations,
    loadConversationCalls,
    scrollToBottom,
    toast,
  ]);

  return { socket, activeViewers, typingAgents };
};
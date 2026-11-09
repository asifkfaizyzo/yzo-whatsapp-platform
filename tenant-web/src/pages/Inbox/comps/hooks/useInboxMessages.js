// tenant-web/src/pages/Inbox/comps/hooks/useInboxMessages.js (do not remove this comment)

import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../../../api/axios";
import { useToast } from "../../../../context/ToastContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import {
  getConversationMessages,
  markConversationAsRead,
} from "../../../../api/conversation";
import { sendMessage, deleteMessage } from "../../../../api/message";
import { getUnreadCount } from "../utils/inboxHelpers";

/**
 * Manages message loading, sending, deleting, unread tracking,
 * and the merged message+call timeline for the active chat.
 *
 * @param {object}   opts
 * @param {string}   opts.activeChatId
 * @param {object}   opts.activeChat      - current conversation object
 * @param {object}   opts.socket          - from useInboxSocket
 * @param {Array}    opts.activeChatCalls - from useInboxCalls (for timeline merge)
 * @param {Function} opts.loadConversations - from useInboxConversations
 * @param {Function} opts.scrollToBottom
 */
export const useInboxMessages = ({
  activeChatId,
  activeChat,
  socket,
  activeChatCalls,
  loadConversations,
  scrollToBottom,
}) => {
  const toast = useToast();
  const confirm = useConfirm();

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});

  // ── Delete Message State ──
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  // ── Typing Refs (used by ChatInput via socket) ──
  const typingTimeoutRef = { current: null };
  const isTypingRef = { current: false };

  // ── Load Messages ──
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let isCurrent = true;
    const load = async () => {
      setLoadingMessages(true);
      try {
        const res = await getConversationMessages(activeChatId, 50);
        if (isCurrent && res.success) {
          setMessages(res.data?.messages || []);
          setTimeout(() => scrollToBottom?.(true), 50);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (isCurrent) setLoadingMessages(false);
      }
    };
    load();
    return () => {
      isCurrent = false;
    };
  }, [activeChatId]);

  // ── Clear Unread on Chat Open ──
  useEffect(() => {
    if (!activeChatId) return;
    setUnreadMap((prev) => ({ ...prev, [String(activeChatId)]: 0 }));

    api
      .patch(
        `${import.meta.env.VITE_BACKEND_URL}/tenant/conversations/mark-read/${activeChatId}`,
      )
      .catch((err) => console.error("Failed to mark as read:", err));
  }, [activeChatId]);

  // ── Initialize unreadMap when conversations load ──
  const initUnreadMap = useCallback(
    (chats) => {
      setUnreadMap((prev) => {
        const next = { ...prev };
        chats.forEach((c) => {
          if (next[String(c.id)] == null) next[String(c.id)] = 0;
        });
        return next;
      });
    },
    [],
  );

  // ── Merged Timeline (messages + calls) ──
  const timelineItems = useMemo(() => {
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

  // ── Send Message ──
  const handleSendMessage = async (
    e,
    typedMessage,
    setTypedMessage,
    stagedQuickReply,
    setStagedQuickReply,
  ) => {
    e.preventDefault();
    if (
      !typedMessage.trim() ||
      !activeChatId ||
      !activeChat?.contact?.id
    )
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

    const res = await sendMessage(
      activeChat.contact.id,
      messageText,
      sendOptions,
    );
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

  return {
    messages,
    setMessages,
    loadingMessages,
    unreadMap,
    setUnreadMap,
    initUnreadMap,
    timelineItems,
    hoveredMessageId,
    setHoveredMessageId,
    deleteConfirmId,
    setDeleteConfirmId,
    deletingMessageId,
    typingTimeoutRef,
    isTypingRef,
    handleSendMessage,
    handleDeleteMessage,
  };
};
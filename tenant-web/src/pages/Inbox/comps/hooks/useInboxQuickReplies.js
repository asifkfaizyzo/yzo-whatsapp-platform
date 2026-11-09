// tenant-web/src/pages/Inbox/comps/hooks/useInboxQuickReplies.js (do not remove this comment)

import { useState, useEffect, useRef, useCallback } from "react";
import { getQuickReplies } from "../../../../api/quickReply";
import { interpolateQuickReply } from "../utils/inboxHelpers";

/**
 * Manages quick reply loading (with 5-min cache), filtering,
 * keyboard navigation, and selection/interpolation into the input.
 *
 * @param {object} opts
 * @param {object} opts.activeChat     - current conversation (for contact data)
 * @param {object} opts.user           - authenticated user from useAuthStore
 * @param {Function} opts.setTypedMessage - setter from parent for the input field
 */
export const useInboxQuickReplies = ({
  activeChat,
  user,
  setTypedMessage,
}) => {
  const [quickRepliesList, setQuickRepliesList] = useState([]);
  const [showQuickReplyPopover, setShowQuickReplyPopover] = useState(false);
  const [filteredQuickReplies, setFilteredQuickReplies] = useState([]);
  const [quickReplySelectedIndex, setQuickReplySelectedIndex] = useState(0);
  const [stagedQuickReply, setStagedQuickReply] = useState(null);
  const lastFetchRef = useRef(0);

  // ── Load Quick Replies (cached 5 min) ──
  const loadQuickReplies = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (
        !force &&
        quickRepliesList.length > 0 &&
        now - lastFetchRef.current < 5 * 60 * 1000
      ) {
        return;
      }
      try {
        const res = await getQuickReplies({
          limit: 100,
          includeInactive: false,
        });
        if (res.success && res.data) {
          setQuickRepliesList(res.data);
          lastFetchRef.current = now;
        }
      } catch (err) {
        console.warn("Failed to load quick replies:", err);
      }
    },
    [quickRepliesList.length],
  );

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  // ── Select a Quick Reply ──
  const handleSelectQuickReply = (reply) => {
    if (!reply) return;
    const interpolated = interpolateQuickReply(
      reply.content,
      activeChat?.contact,
      user,
    );
    setTypedMessage(interpolated);
    if (reply.mediaUrl) {
      setStagedQuickReply(reply);
    }
    setShowQuickReplyPopover(false);
    setFilteredQuickReplies([]);
  };

  return {
    quickRepliesList,
    showQuickReplyPopover,
    setShowQuickReplyPopover,
    filteredQuickReplies,
    setFilteredQuickReplies,
    quickReplySelectedIndex,
    setQuickReplySelectedIndex,
    stagedQuickReply,
    setStagedQuickReply,
    loadQuickReplies,
    handleSelectQuickReply,
  };
};
// tenant-web/src/pages/Inbox/comps/hooks/useInboxConversations.js (do not remove this comment)

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../../api/axios";
import { useAuthStore } from "../../../../store/useAuthStore";
import { useToast } from "../../../../context/ToastContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import {
  getAssignedConversations,
  updateConversationStatus,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
  getArchivedConversations,
  bulkReassignConversations,
  togglePinConversation,
} from "../../../../api/conversation";
import {
  addTagToContact,
  removeTagFromContact,
} from "../../../../api/contact";
import { getTags } from "../../../../api/tag";
import { getTenantUsers, assignContact } from "../../../../api/tenant";
import { getUnreadCount } from "../utils/inboxHelpers";

/**
 * Manages conversation list: loading, filtering, pinning, archiving,
 * deleting, bulk reassign, status changes, tag/agent assignment.
 *
 * Owns: chats, loading, channelCounts, allTags, allAgents, archived state,
 *       bulk reassign state, sidebar menu state, filter/tab derived data.
 */
export const useInboxConversations = ({ activeChatId, socket }) => {
  const confirm = useConfirm();
  const toast = useToast();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = user?.type === "TENANT" ? "admin" : "agent";
  const filter =
    searchParams.get("filter") || (userRole === "admin" ? "all" : "my");
  const activeTab = searchParams.get("tab") || "all";

  // ── Core State ──
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("ALL");
  const [channelCounts, setChannelCounts] = useState({
    ALL: 0,
    WHATSAPP: 0,
    MESSENGER: 0,
    INSTAGRAM: 0,
  });
  const [showChannelFilter, setShowChannelFilter] = useState(false);
  const channelFilterRef = useRef(null);

  // ── Tags & Agents ──
  const [allTags, setAllTags] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [assigningTag, setAssigningTag] = useState(false);
  const [assigningUser, setAssigningUser] = useState(false);

  // ── Archived ──
  const [showArchived, setShowArchived] = useState(false);
  const [archivedChats, setArchivedChats] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [unarchivingId, setUnarchivingId] = useState(null);

  // ── Conversation Menu ──
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);
  const [archivingConv, setArchivingConv] = useState(false);
  const convMenuRef = useRef(null);

  // ── Bulk Reassign ──
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState([]);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkTargetUserId, setBulkTargetUserId] = useState("");
  const [bulkReassigning, setBulkReassigning] = useState(false);

  // ── Sidebar Menu ──
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const sidebarMenuRef = useRef(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAllChats, setDeletingAllChats] = useState(false);

  // ── Load Tags & Agents ──
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
        const res = await getAssignedConversations(
          1,
          50,
          filter,
          selectedChannel,
        );
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
          if (returnedChannelCounts) setChannelCounts(returnedChannelCounts);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, selectedChannel],
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Reset dropdowns on chat change ──
  useEffect(() => {
    setSelectedTag("");
    setSelectedAgent("");
  }, [activeChatId]);

  // ── Click-outside handlers ──
  useEffect(() => {
    const handler = (e) => {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target))
        setShowConvMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (
        sidebarMenuRef.current &&
        !sidebarMenuRef.current.contains(e.target)
      )
        setShowSidebarMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (
        channelFilterRef.current &&
        !channelFilterRef.current.contains(e.target)
      )
        setShowChannelFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Load Archived ──
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

  useEffect(() => {
    if (showArchived) loadArchivedConversations();
  }, [showArchived]);

  // ── Toggle Pin (max 3) ──
  const handleTogglePin = async (e, convId) => {
    e?.stopPropagation();
    if (!convId) return;
    const targetChat = chats.find((c) => String(c.id) === String(convId));
    if (!targetChat) return;

    if (!targetChat.isPinned) {
      const pinnedCount = chats.filter((c) => Boolean(c.isPinned)).length;
      if (pinnedCount >= 3) {
        toast.info("Maximum 3 chats can be pinned at a time.");
        return;
      }
    }

    try {
      const res = await togglePinConversation(convId);
      if (res.success && res.conversation) {
        const newPinned = Boolean(res.conversation.isPinned);
        toast.success(newPinned ? "Chat pinned to top" : "Chat unpinned");
        setChats((prev) => {
          const updated = prev.map((c) =>
            String(c.id) === String(convId)
              ? {
                  ...c,
                  isPinned: newPinned,
                  pinnedAt: res.conversation.pinnedAt,
                }
              : c,
          );
          return [...updated].sort((a, b) => {
            if (Boolean(a.isPinned) !== Boolean(b.isPinned))
              return a.isPinned ? -1 : 1;
            if (a.isPinned && b.isPinned)
              return new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0);
            return (
              new Date(b.updatedAt || b.lastActivityAt || 0) -
              new Date(a.updatedAt || a.lastActivityAt || 0)
            );
          });
        });
      } else {
        toast.info(res.message || "Maximum 3 chats can be pinned at a time.");
      }
    } catch {
      toast.info("Maximum 3 chats can be pinned at a time.");
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

  // ── Archive ──
  const handleArchiveConversation = async () => {
    if (!activeChatId) return;
    const ok = await confirm({
      type: "warning",
      title: "Archive Conversation?",
      message:
        "Archive this conversation? It will be hidden from your inbox.",
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
        setShowConvMenu(false);
      } else {
        toast.error(res.message);
      }
    } catch {
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
        setShowDeleteConfirm(false);
        setShowConvMenu(false);
        toast.success("Conversation deleted successfully.");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to delete conversation");
    }
    setDeletingConv(false);
  };

  // ── Unarchive ──
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
    } catch {
      toast.error("Failed to unarchive conversation");
    }
    setUnarchivingId(null);
  };

  // ── Assign Tag ──
  const handleAssignTag = async () => {
    if (!selectedTag) return;
    const contactId = chats.find(
      (c) => String(c.id) === String(activeChatId),
    )?.contact?.id;
    if (!contactId) return;
    setAssigningTag(true);
    try {
      const res = await addTagToContact(contactId, selectedTag);
      if (res.success) {
        setChats((prev) =>
          prev.map((c) => {
            if (String(c.id) !== String(activeChatId)) return c;
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
          }),
        );
        setSelectedTag("");
        toast.success("Tag added successfully!");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to assign tag");
    }
    setAssigningTag(false);
  };

  // ── Remove Tag ──
  const handleRemoveTag = async (tagId) => {
    const contactId = chats.find(
      (c) => String(c.id) === String(activeChatId),
    )?.contact?.id;
    if (!contactId) return;
    try {
      const res = await removeTagFromContact(contactId, tagId);
      if (res.success) {
        setChats((prev) =>
          prev.map((c) => {
            if (String(c.id) !== String(activeChatId)) return c;
            return {
              ...c,
              contact: {
                ...c.contact,
                contactTags: (c.contact?.contactTags || []).filter(
                  (ct) => ct.tag?.id !== tagId,
                ),
              },
            };
          }),
        );
        toast.success("Tag removed successfully!");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to remove tag");
    }
  };

  // ── Assign Agent ──
  const handleAssignAgent = async () => {
    if (!selectedAgent) return;
    const contactId = chats.find(
      (c) => String(c.id) === String(activeChatId),
    )?.contact?.id;
    if (!contactId) return;
    setAssigningUser(true);
    try {
      const res = await assignContact(contactId, selectedAgent);
      if (res.success) {
        setChats((prev) =>
          prev.map((c) =>
            String(c.id) === String(activeChatId)
              ? {
                  ...c,
                  contact: { ...c.contact, assignedTo: selectedAgent },
                }
              : c,
          ),
        );
        setSelectedAgent("");
        toast.success("Agent assigned successfully!");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to assign agent");
    }
    setAssigningUser(false);
  };

  // ── Bulk Select ──
  const handleToggleBulkSelectMode = () => {
    setBulkSelectMode((prev) => !prev);
    setSelectedConvIds([]);
  };
  const handleToggleConvSelection = (convId) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId)
        ? prev.filter((id) => id !== convId)
        : [...prev, convId],
    );
  };

  // ── Bulk Reassign ──
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
      const res = await bulkReassignConversations(
        selectedConvIds,
        newUserId,
      );
      if (res.success) {
        toast.success(
          res.message ||
            `${selectedConvIds.length} conversation(s) reassigned`,
        );
        setChats((prev) =>
          prev.map((c) =>
            selectedConvIds.includes(c.id)
              ? {
                  ...c,
                  contact: { ...c.contact, assignedTo: newUserId },
                }
              : c,
          ),
        );
        setSelectedConvIds([]);
        setBulkSelectMode(false);
        setShowBulkReassignModal(false);
        setBulkTargetUserId("");
      } else {
        toast.error(res.message || "Failed to reassign conversations");
      }
    } catch {
      toast.error("Something went wrong during bulk reassign");
    }
    setBulkReassigning(false);
  };

  // ── Delete All Chats ──
  const handleDeleteAllChats = async () => {
    if (userRole !== "admin") return;
    setDeletingAllChats(true);
    try {
      for (const chat of chats) {
        await deleteConversation(chat.id);
      }
      toast.success(`${chats.length} chat(s) deleted successfully`);
      setChats([]);
      setShowDeleteAllConfirm(false);
      setShowSidebarMenu(false);
    } catch {
      toast.error("Failed to delete all chats");
    }
    setDeletingAllChats(false);
  };

  // ── Channel Filter ──
  const handleSelectChannelFilter = (channelKey) => {
    setSelectedChannel(channelKey);
    setShowChannelFilter(false);
  };

  // ── Tab Click ──
  const handleTabClick = (tabValue) => {
    const params = { filter };
    if (tabValue !== "all") params.tab = tabValue;
    if (activeChatId) params.conversationId = activeChatId;
    setSearchParams(params);
  };

  // ── Derived: Channel Counts ──
  const activeChannelCounts = {
    ALL: channelCounts?.ALL || chats.length,
    WHATSAPP:
      channelCounts?.WHATSAPP ||
      chats.filter(
        (c) =>
          !c.channel ||
          (c.channel || c.platform || "").toUpperCase() === "WHATSAPP",
      ).length,
    MESSENGER:
      channelCounts?.MESSENGER ||
      chats.filter(
        (c) =>
          (c.channel || c.platform || "").toUpperCase() === "MESSENGER",
      ).length,
    INSTAGRAM:
      channelCounts?.INSTAGRAM ||
      chats.filter(
        (c) =>
          (c.channel || c.platform || "").toUpperCase() === "INSTAGRAM",
      ).length,
  };

  // ── Derived: Filtered Chats ──
  const filteredChats = chats.filter((c) => {
    if (selectedChannel && selectedChannel !== "ALL") {
      const chatChannel = (
        c.channel ||
        c.platform ||
        "WHATSAPP"
      ).toUpperCase();
      if (chatChannel !== selectedChannel.toUpperCase()) return false;
    }
    const name = c.contact?.name || "";
    const phone = c.contact?.phone || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery)
    );
  });

  // ── Derived: Tab Counts ──
  // unreadMap is passed from useInboxMessages via the page component
  const getTabCounts = (unreadMap) => ({
    all: filteredChats.length,
    unread: filteredChats.filter(
      (c) =>
        c.status === "OPEN" &&
        getUnreadCount(c.id, activeChatId, unreadMap, chats) > 0,
    ).length,
    open: filteredChats.filter((c) => c.status === "OPEN").length,
    closed: filteredChats.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED",
    ).length,
  });

  const getTabFilteredChats = (unreadMap) =>
    filteredChats.filter((c) => {
      switch (activeTab) {
        case "unread":
          return (
            c.status === "OPEN" &&
            getUnreadCount(c.id, activeChatId, unreadMap, chats) > 0
          );
        case "open":
          return c.status === "OPEN";
        case "closed":
          return c.status === "RESOLVED" || c.status === "CLOSED";
        default:
          return true;
      }
    });

  const handleSelectAll = (tabFilteredChats) => {
    if (selectedConvIds.length === tabFilteredChats.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(tabFilteredChats.map((c) => c.id));
    }
  };

  return {
    // State
    chats,
    setChats,
    loading,
    searchQuery,
    setSearchQuery,
    selectedChannel,
    showChannelFilter,
    setShowChannelFilter,
    channelFilterRef,
    userRole,
    filter,
    activeTab,
    allTags,
    allAgents,
    selectedTag,
    setSelectedTag,
    selectedAgent,
    setSelectedAgent,
    assigningTag,
    assigningUser,
    showArchived,
    setShowArchived,
    archivedChats,
    loadingArchived,
    unarchivingId,
    showConvMenu,
    setShowConvMenu,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deletingConv,
    archivingConv,
    convMenuRef,
    bulkSelectMode,
    setBulkSelectMode,
    selectedConvIds,
    showBulkReassignModal,
    setShowBulkReassignModal,
    bulkTargetUserId,
    setBulkTargetUserId,
    bulkReassigning,
    showSidebarMenu,
    setShowSidebarMenu,
    sidebarMenuRef,
    showDeleteAllConfirm,
    setShowDeleteAllConfirm,
    deletingAllChats,
    // Derived
    activeChannelCounts,
    getTabCounts,
    getTabFilteredChats,
    // Actions
    loadConversations,
    handleTogglePin,
    handleUpdateStatus,
    handleArchiveConversation,
    handleDeleteConversation,
    handleUnarchiveConversation,
    handleAssignTag,
    handleRemoveTag,
    handleAssignAgent,
    handleToggleBulkSelectMode,
    handleToggleConvSelection,
    handleSelectAll,
    handleBulkReassign,
    handleDeleteAllChats,
    handleSelectChannelFilter,
    handleTabClick,
  };
};
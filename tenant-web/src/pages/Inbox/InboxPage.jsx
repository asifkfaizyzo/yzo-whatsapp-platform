// tenant-web/src/pages/Inbox/InboxPage.jsx (do not remove this comment)

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useToast } from "../../context/ToastContext";
import { getContacts } from "../../api/contact";
import { createConversation } from "../../api/conversation";

// Phase 1 — shared utils
import {
  getMediaUrl,
  getAvatarUrl,
  getAvatarStyle,
} from "../../utils/mediaHelpers";
import { formatTime, formatDate } from "../../utils/dateHelpers";

// Phase 2 — local utils
import {
  formatLastMessagePreview,
  is24hExpired,
  canDeleteMessage,
  getUnreadCount,
  getTagColor,
} from "./comps/utils/inboxHelpers";

// Phase 3 — hooks
import { useInboxConversations } from "./comps/hooks/useInboxConversations";
import { useInboxCalls } from "./comps/hooks/useInboxCalls";
import { useInboxMessages } from "./comps/hooks/useInboxMessages";
import { useInboxSocket } from "./comps/hooks/useInboxSocket";
import { useInboxMedia } from "./comps/hooks/useInboxMedia";
import { useInboxQuickReplies } from "./comps/hooks/useInboxQuickReplies";

// Phase 4 — modals & empty state
import ArchivedChatsModal from "./comps/modals/ArchivedChatsModal";
import BulkReassignModal from "./comps/modals/BulkReassignModal";
import DeleteAllChatsModal from "./comps/modals/DeleteAllChatsModal";
import CallPermissionModal from "./comps/modals/CallPermissionModal";
import CallConfirmModal from "./comps/modals/CallConfirmModal";
import InboxEmptyState from "./comps/modals/InboxEmptyState";

// Phase 6 — moved child components
import ChatSidebar from "./comps/ChatSidebar";
import ChatHeader from "./comps/ChatHeader";
import ChatFeed from "./comps/ChatFeed";
import ChatInput from "./comps/ChatInput";
import ContactPanel from "./comps/ContactPanel";
import NewChatModal from "./comps/NewChatModal";
import LocationModal from "./comps/LocationModal";
import MediaPreviewModal from "./comps/MediaPreviewModal";
import MediaStagingOverlay from "./comps/MediaStagingOverlay";

export default function InboxPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlConversationId = searchParams.get("conversationId");
  const userRole = user?.type === "TENANT" ? "admin" : "agent";
  const filter =
    searchParams.get("filter") || (userRole === "admin" ? "all" : "my");

  // ── Core page-level state ──
  const [activeChatId, setActiveChatId] = useState(urlConversationId || null);
  const [typedMessage, setTypedMessage] = useState("");

  // ── Scroll ──
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

  const scrollToBottom = useCallback((smooth = false) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    setShowScrollArrow(
      container.scrollHeight - container.scrollTop - container.clientHeight >
        350,
    );
  }, []);

  // ── Emoji Picker (page-level, passed to ChatInput) ──
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  const handleEmojiClick = (emojiData) => {
    setTypedMessage((prev) => prev + emojiData.emoji);
  };

  // ── New Chat Modal (page-level) ──
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    if (!showNewChatModal) return;
    const load = async () => {
      setLoadingContacts(true);
      const res = await getContacts(1, 100);
      if (res.success) setAllContacts(res.data.contacts || []);
      setLoadingContacts(false);
    };
    load();
  }, [showNewChatModal]);

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

  // ═══════════════════════════════════════════════════════════════
  // HOOKS
  // Order: conversations → calls → messages → socket → media → quickReplies
  // Socket needs setters from conversations/messages/calls.
  // Messages receives socket=null; typing-stop is handled at page level.
  // ═══════════════════════════════════════════════════════════════

  const conv = useInboxConversations({ activeChatId });
  const calls = useInboxCalls({ activeChatId });

  const activeChat =
    conv.chats.find((c) => String(c.id) === String(activeChatId)) || null;

  const msgs = useInboxMessages({
    activeChatId,
    activeChat,
    socket: null, // typing-stop handled by page-level handleSubmitMessage
    activeChatCalls: calls.activeChatCalls,
    loadConversations: conv.loadConversations,
    scrollToBottom,
  });

  const sock = useInboxSocket({
    activeChatId,
    setChats: conv.setChats,
    setMessages: msgs.setMessages,
    setUnreadMap: msgs.setUnreadMap,
    setActiveChatCalls: calls.setActiveChatCalls,
    loadConversations: conv.loadConversations,
    loadConversationCalls: calls.loadConversationCalls,
    scrollToBottom,
  });

  const media = useInboxMedia({ activeChatId, activeChat });

  const qr = useInboxQuickReplies({
    activeChat,
    user,
    setTypedMessage,
  });

  // ═══════════════════════════════════════════════════════════════
  // CROSS-HOOK WIRING
  // ═══════════════════════════════════════════════════════════════

  // Sync activeChatId with URL
  useEffect(() => {
    setActiveChatId(urlConversationId || null);
  }, [urlConversationId]);

  // Initialize unread map when conversations load
  useEffect(() => {
    if (conv.chats.length > 0) msgs.initUnreadMap(conv.chats);
  }, [conv.chats]);

  // Scroll to bottom on new messages / chat change
  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(false), 100);
    return () => clearTimeout(timer);
  }, [msgs.messages, activeChatId, scrollToBottom]);

  // Persist global unread count for TopNavBar / Sidebar
  const tabCounts = conv.getTabCounts(msgs.unreadMap);
  useEffect(() => {
    localStorage.setItem("inbox_unread_count", String(tabCounts.unread));
    window.dispatchEvent(new Event("unread_updated"));
  }, [tabCounts.unread]);

  const tabFilteredChats = conv.getTabFilteredChats(msgs.unreadMap);

  // ── Chat Selection ──
  const handleSelectChat = useCallback(
    (chatId) => {
      if (String(chatId) === String(activeChatId)) return;
      setActiveChatId(chatId);
      qr.setStagedQuickReply(null);
      qr.setShowQuickReplyPopover(false);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("conversationId", String(chatId));
          return next;
        },
        { replace: true },
      );
    },
    [activeChatId, setSearchParams, qr],
  );

  // ── New Chat ──
  const handleSelectContactForChat = async (contactId) => {
    const res = await createConversation(contactId);
    if (res.success) {
      setShowNewChatModal(false);
      await conv.loadConversations();
      setActiveChatId(res.data.id);
      setSearchParams({ filter, conversationId: res.data.id });
    } else {
      toast.error("Could not start chat: " + res.message);
    }
  };

  // ── Message Send Wrapper ──
  // Adds socket typing-stop that useInboxMessages can't do (socket not available at hook init)
  const handleSubmitMessage = (e) => {
    msgs.handleSendMessage(
      e,
      typedMessage,
      setTypedMessage,
      qr.stagedQuickReply,
      qr.setStagedQuickReply,
    );
    if (sock.socket && activeChatId) {
      sock.socket.emit("agent_typing_stop", {
        conversationId: activeChatId,
      });
    }
  };

  // ── Inbox Tabs Config ──
  const inboxTabs = [
    { label: "All", value: "all", count: tabCounts.all },
    { label: "Unread", value: "unread", count: tabCounts.unread },
    { label: "Open", value: "open", count: tabCounts.open },
    { label: "Closed", value: "closed", count: tabCounts.closed },
  ];

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div
      data-inbox-mounted="true"
      className="h-[calc(100vh-130px)] flex rounded-3xl overflow-hidden animate-in fade-in duration-200 border border-[#075E54]/10 shadow-lg shadow-[#075E54]/5"
    >
      {/* ── LEFT SIDEBAR ── */}
      <ChatSidebar
        selectedChannel={conv.selectedChannel}
        setShowNewChatModal={setShowNewChatModal}
        userRole={conv.userRole}
        sidebarMenuRef={conv.sidebarMenuRef}
        showSidebarMenu={conv.showSidebarMenu}
        setShowSidebarMenu={conv.setShowSidebarMenu}
        setBulkSelectMode={conv.setBulkSelectMode}
        setShowDeleteAllConfirm={conv.setShowDeleteAllConfirm}
        searchQuery={conv.searchQuery}
        setSearchQuery={conv.setSearchQuery}
        channelFilterRef={conv.channelFilterRef}
        showChannelFilter={conv.showChannelFilter}
        setShowChannelFilter={conv.setShowChannelFilter}
        handleSelectChannelFilter={conv.handleSelectChannelFilter}
        activeChannelCounts={conv.activeChannelCounts}
        inboxTabs={inboxTabs}
        activeTab={conv.activeTab}
        handleTabClick={conv.handleTabClick}
        bulkSelectMode={conv.bulkSelectMode}
        selectedConvIds={conv.selectedConvIds}
        tabFilteredChats={tabFilteredChats}
        handleSelectAll={() => conv.handleSelectAll(tabFilteredChats)}
        setShowBulkReassignModal={conv.setShowBulkReassignModal}
        loading={conv.loading}
        activeChatId={activeChatId}
        getAvatarStyle={getAvatarStyle}
        getAvatarUrl={getAvatarUrl}
        getUnreadCount={(convId) =>
          getUnreadCount(convId, activeChatId, msgs.unreadMap, conv.chats)
        }
        formatTime={formatTime}
        handleToggleConvSelection={conv.handleToggleConvSelection}
        handleSelectChat={handleSelectChat}
        formatLastMessagePreview={formatLastMessagePreview}
        setShowArchived={conv.setShowArchived}
        archivedChats={conv.archivedChats}
      />

      {/* ── MIDDLE CHAT AREA ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <MediaStagingOverlay
          selectedFile={media.selectedFile}
          handleCancelFile={media.handleCancelFile}
          filePreview={media.filePreview}
          stagingEmojiPickerRef={media.stagingEmojiPickerRef}
          showStagingEmojiPicker={media.showStagingEmojiPicker}
          setShowStagingEmojiPicker={media.setShowStagingEmojiPicker}
          handleStagingEmojiClick={media.handleStagingEmojiClick}
          fileCaption={media.fileCaption}
          setFileCaption={media.setFileCaption}
          handleSendFile={media.handleSendFile}
          uploadingFile={media.uploadingFile}
        />

        {activeChat ? (
          <>
            <ChatHeader
              activeChat={activeChat}
              getAvatarUrl={getAvatarUrl}
              getAvatarStyle={getAvatarStyle}
              activeViewers={sock.activeViewers}
              user={user}
              handleRequestCallPermission={calls.handleRequestCallPermission}
              handleInitiateCall={calls.handleSmartCallClick}
              handleUpdateStatus={conv.handleUpdateStatus}
              showConvMenu={conv.showConvMenu}
              setShowConvMenu={conv.setShowConvMenu}
              handleArchiveConversation={conv.handleArchiveConversation}
              archivingConv={conv.archivingConv}
              userRole={conv.userRole}
              showDeleteConfirm={conv.showDeleteConfirm}
              setShowDeleteConfirm={conv.setShowDeleteConfirm}
              showContactPanel={media.showContactPanel}
              setShowContactPanel={media.setShowContactPanel}
              is24hExpired={is24hExpired}
              typingAgents={sock.typingAgents}
              deletingConv={conv.deletingConv}
              handleDeleteConversation={conv.handleDeleteConversation}
              convMenuRef={conv.convMenuRef}
            />

            <ChatFeed
              chatContainerRef={chatContainerRef}
              handleScroll={handleScroll}
              loadingMessages={msgs.loadingMessages}
              timelineItems={msgs.timelineItems}
              formatDate={formatDate}
              activeChat={activeChat}
              handleInitiateCall={calls.handleSmartCallClick}
              formatTime={formatTime}
              hoveredMessageId={msgs.hoveredMessageId}
              setHoveredMessageId={msgs.setHoveredMessageId}
              canDeleteMessage={(msg) => canDeleteMessage(msg, user)}
              deleteConfirmId={msgs.deleteConfirmId}
              setDeleteConfirmId={msgs.setDeleteConfirmId}
              deletingMessageId={msgs.deletingMessageId}
              handleDeleteMessage={msgs.handleDeleteMessage}
              user={user}
              getMediaUrl={getMediaUrl}
              setPreviewImageModal={media.setPreviewImageModal}
              typingAgents={sock.typingAgents}
              messagesEndRef={messagesEndRef}
              showScrollArrow={showScrollArrow}
              scrollToBottom={scrollToBottom}
            />

            <ChatInput
              handleSendMessage={handleSubmitMessage}
              activeChat={activeChat}
              handleUpdateStatus={conv.handleUpdateStatus}
              stagedQuickReply={qr.stagedQuickReply}
              setStagedQuickReply={qr.setStagedQuickReply}
              emojiPickerRef={emojiPickerRef}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              handleEmojiClick={handleEmojiClick}
              fileInputRef={media.fileInputRef}
              handleFileSelect={media.handleFileSelect}
              documentInputRef={media.documentInputRef}
              photoVideoInputRef={media.photoVideoInputRef}
              audioInputRef={media.audioInputRef}
              cameraInputRef={media.cameraInputRef}
              attachMenuRef={media.attachMenuRef}
              showAttachMenu={media.showAttachMenu}
              setShowAttachMenu={media.setShowAttachMenu}
              handleAttachMenuClick={media.handleAttachMenuClick}
              showQuickReplyPopover={qr.showQuickReplyPopover}
              filteredQuickReplies={qr.filteredQuickReplies}
              quickReplySelectedIndex={qr.quickReplySelectedIndex}
              handleSelectQuickReply={qr.handleSelectQuickReply}
              setShowQuickReplyPopover={qr.setShowQuickReplyPopover}
              user={user}
              typedMessage={typedMessage}
              setQuickReplySelectedIndex={qr.setQuickReplySelectedIndex}
              setFilteredQuickReplies={qr.setFilteredQuickReplies}
              setTypedMessage={setTypedMessage}
              quickRepliesList={qr.quickRepliesList}
              socket={sock.socket}
              activeChatId={activeChatId}
              isTypingRef={msgs.isTypingRef}
              typingTimeoutRef={msgs.typingTimeoutRef}
              isRecording={media.isRecording}
              recordingTime={media.recordingTime}
              handleCancelRecording={media.handleCancelRecording}
              handleStopRecording={media.handleStopRecording}
              handleStartRecording={media.handleStartRecording}
            />
          </>
        ) : (
          <InboxEmptyState
            selectedChannel={conv.selectedChannel}
            tabFilteredChatsLength={tabFilteredChats.length}
            loading={conv.loading}
            onSelectAllChannels={() => conv.handleSelectChannelFilter("ALL")}
          />
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <ContactPanel
        activeChat={activeChat}
        showContactPanel={media.showContactPanel}
        setShowContactPanel={media.setShowContactPanel}
        rightPanelSubView={media.rightPanelSubView}
        setRightPanelSubView={media.setRightPanelSubView}
        mediaActiveTab={media.mediaActiveTab}
        setMediaActiveTab={media.setMediaActiveTab}
        mediaCategoryCounts={media.mediaCategoryCounts}
        mediaItems={media.mediaItems}
        loadingMediaItems={media.loadingMediaItems}
        activeChatCalls={calls.activeChatCalls}
        loadingCalls={calls.loadingCalls}
        userRole={conv.userRole}
        allAgents={conv.allAgents}
        selectedAgent={conv.selectedAgent}
        setSelectedAgent={conv.setSelectedAgent}
        handleAssignAgent={conv.handleAssignAgent}
        assigningUser={conv.assigningUser}
        allTags={conv.allTags}
        selectedTag={conv.selectedTag}
        setSelectedTag={conv.setSelectedTag}
        handleAssignTag={conv.handleAssignTag}
        assigningTag={conv.assigningTag}
        handleRemoveTag={conv.handleRemoveTag}
        handleTogglePin={conv.handleTogglePin}
        getAvatarStyle={getAvatarStyle}
        getTagColor={getTagColor}
        getAvatarUrl={getAvatarUrl}
        getMediaUrl={getMediaUrl}
        formatDate={formatDate}
        setPreviewImageModal={media.setPreviewImageModal}
        activeChatId={activeChatId}
        loadConversationCalls={calls.loadConversationCalls}
        handleInitiateCall={calls.handleSmartCallClick}
      />

      {/* ── MODALS ── */}
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

      <ArchivedChatsModal
        showArchived={conv.showArchived}
        setShowArchived={conv.setShowArchived}
        archivedChats={conv.archivedChats}
        loadingArchived={conv.loadingArchived}
        unarchivingId={conv.unarchivingId}
        handleUnarchiveConversation={conv.handleUnarchiveConversation}
        getAvatarStyle={getAvatarStyle}
        formatDate={formatDate}
        formatLastMessagePreview={formatLastMessagePreview}
      />

      <LocationModal
        showLocationModal={media.showLocationModal}
        setShowLocationModal={media.setShowLocationModal}
        locationForm={media.locationForm}
        setLocationForm={media.setLocationForm}
        locationError={media.locationError}
        setLocationError={media.setLocationError}
        sendingLocation={media.sendingLocation}
        handleSendLocation={media.handleSendLocation}
      />

      <BulkReassignModal
        showBulkReassignModal={conv.showBulkReassignModal}
        setShowBulkReassignModal={conv.setShowBulkReassignModal}
        selectedConvIds={conv.selectedConvIds}
        bulkTargetUserId={conv.bulkTargetUserId}
        setBulkTargetUserId={conv.setBulkTargetUserId}
        allAgents={conv.allAgents}
        bulkReassigning={conv.bulkReassigning}
        handleBulkReassign={conv.handleBulkReassign}
      />

      <DeleteAllChatsModal
        showDeleteAllConfirm={conv.showDeleteAllConfirm}
        setShowDeleteAllConfirm={conv.setShowDeleteAllConfirm}
        chatCount={conv.chats.length}
        deletingAllChats={conv.deletingAllChats}
        handleDeleteAllChats={conv.handleDeleteAllChats}
        userRole={conv.userRole}
      />

      <MediaPreviewModal
        previewImageModal={media.previewImageModal}
        setPreviewImageModal={media.setPreviewImageModal}
      />

      <CallPermissionModal
        showCallPermissionModal={calls.showCallPermissionModal}
        setShowCallPermissionModal={calls.setShowCallPermissionModal}
        pendingCallContact={calls.pendingCallContact}
        setPendingCallContact={calls.setPendingCallContact}
        handleRequestCallPermission={calls.handleRequestCallPermission}
      />

      <CallConfirmModal
        showInitiateCallConfirmModal={calls.showInitiateCallConfirmModal}
        setShowInitiateCallConfirmModal={calls.setShowInitiateCallConfirmModal}
        pendingCallContact={calls.pendingCallContact}
        setPendingCallContact={calls.setPendingCallContact}
        handleInitiateCall={calls.handleInitiateCall}
      />
    </div>
  );
}
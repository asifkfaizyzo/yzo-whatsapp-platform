import React from 'react';
import {
  MessageSquarePlus,
  MoreVertical,
  UserCheck,
  Trash2,
  Search,
  Filter,
  Pin,
  RefreshCw,
} from "lucide-react";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from "react-icons/fa";

export default function ChatSidebar({
  selectedChannel,
  setShowNewChatModal,
  userRole,
  sidebarMenuRef,
  showSidebarMenu,
  setShowSidebarMenu,
  setBulkSelectMode,
  setShowDeleteAllConfirm,
  searchQuery,
  setSearchQuery,
  channelFilterRef,
  showChannelFilter,
  setShowChannelFilter,
  handleSelectChannelFilter,
  activeChannelCounts,
  inboxTabs,
  activeTab,
  handleTabClick,
  bulkSelectMode,
  selectedConvIds,
  tabFilteredChats,
  handleSelectAll,
  setShowBulkReassignModal,
  loading,
  activeChatId,
  getAvatarStyle,
  getAvatarUrl,
  getUnreadCount,
  formatTime,
  handleToggleConvSelection,
  handleSelectChat,
  formatLastMessagePreview,
  setShowArchived,
  archivedChats,
}) {
  return (
    <div className="w-80 flex flex-col shrink-0 bg-white border-r border-emerald-100">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-tl-3xl">
        <div className="flex items-center gap-2.5">
          <div>
            <span className="text-sm font-bold text-white tracking-wide">
              All Inboxes
            </span>
            <p className="text-[10px] text-emerald-200 font-medium">
              Unified Business Inbox
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* ── New Chat Button (Only for ALL or WHATSAPP channels) ── */}
          {selectedChannel === "ALL" || selectedChannel === "WHATSAPP" ? (
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-semibold rounded-lg transition duration-150 border border-white/10 shrink-0"
              title="Start a new WhatsApp conversation"
            >
              <MessageSquarePlus size={13} />
              <span>New Chat</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1 px-2.5 py-1 bg-white/10 text-white/80 text-[10px] font-semibold rounded-lg border border-white/10 shrink-0 cursor-default"
              title="Instagram and Messenger chats are customer-initiated as per Meta API policy."
            >
              <span>Inbound only</span>
            </div>
          )}

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

      {/* Search & Filter Bar */}
      <div className="px-3 py-2.5 bg-[#F0F2F5] flex items-center gap-2 border-b border-[#E9EDEF]">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-2.5 text-[#54656F]"
            size={14}
          />
          <input
            type="text"
            placeholder="Search or start new chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-transparent focus:border-[#25D366]/40 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 transition shadow-2xs"
          />
        </div>

        {/* Filter button with dropdown */}
        <div className="relative" ref={channelFilterRef}>
          <button
            onClick={() => setShowChannelFilter((prev) => !prev)}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center shrink-0 relative ${selectedChannel !== "ALL"
                ? "bg-[#075E54] text-white border-[#075E54] shadow-xs"
                : "bg-white text-[#54656F] border-gray-200/80 hover:text-[#075E54] hover:bg-emerald-50/50"
              }`}
            title="Filter by channel"
            aria-label="Filter channels"
          >
            <Filter size={15} />
            {selectedChannel !== "ALL" && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#25D366] rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Dropdown Menu */}
          {showChannelFilter && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-emerald-100 overflow-hidden w-52 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#075E54] tracking-wide">
                  Filter by Channel
                </span>
                {selectedChannel !== "ALL" && (
                  <button
                    onClick={() => handleSelectChannelFilter("ALL")}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="p-1">
                {/* All Channels */}
                <button
                  onClick={() => handleSelectChannelFilter("ALL")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${selectedChannel === "ALL"
                      ? "bg-[#075E54] text-white font-semibold"
                      : "text-[#111B21] hover:bg-[#F0F2F5] font-medium"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${selectedChannel === "ALL" ? "bg-white" : "bg-gray-400"
                        }`}
                    />
                    <span>All Channels</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedChannel === "ALL"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                      }`}
                  >
                    {activeChannelCounts?.ALL || 0}
                  </span>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={() => handleSelectChannelFilter("WHATSAPP")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${selectedChannel === "WHATSAPP"
                      ? "bg-[#25D366] text-white font-semibold"
                      : "text-[#111B21] hover:bg-emerald-50/70 font-medium"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <FaWhatsapp
                      className={`text-sm ${selectedChannel === "WHATSAPP"
                          ? "text-white"
                          : "text-[#25D366]"
                        }`}
                    />
                    <span>WhatsApp</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedChannel === "WHATSAPP"
                        ? "bg-white/25 text-white"
                        : "bg-emerald-100 text-emerald-800"
                      }`}
                  >
                    {activeChannelCounts?.WHATSAPP || 0}
                  </span>
                </button>

                {/* Messenger */}
                <button
                  onClick={() => handleSelectChannelFilter("MESSENGER")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${selectedChannel === "MESSENGER"
                      ? "bg-[#0084FF] text-white font-semibold"
                      : "text-[#111B21] hover:bg-blue-50/70 font-medium"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <FaFacebookMessenger
                      className={`text-sm ${selectedChannel === "MESSENGER"
                          ? "text-white"
                          : "text-[#0084FF]"
                        }`}
                    />
                    <span>Messenger</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedChannel === "MESSENGER"
                        ? "bg-white/25 text-white"
                        : "bg-blue-100 text-blue-800"
                      }`}
                  >
                    {activeChannelCounts?.MESSENGER || 0}
                  </span>
                </button>

                {/* Instagram */}
                <button
                  onClick={() => handleSelectChannelFilter("INSTAGRAM")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${selectedChannel === "INSTAGRAM"
                      ? "bg-gradient-to-r from-[#FD1D1D] via-[#E1306C] to-[#833AB4] text-white font-semibold"
                      : "text-[#111B21] hover:bg-fuchsia-50/70 font-medium"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <FaInstagram
                      className={`text-sm ${selectedChannel === "INSTAGRAM"
                          ? "text-white"
                          : "text-[#E1306C]"
                        }`}
                  />
                  <span>Instagram</span>
                </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedChannel === "INSTAGRAM"
                        ? "bg-white/25 text-white"
                        : "bg-fuchsia-100 text-fuchsia-800"
                      }`}
                  >
                    {activeChannelCounts?.INSTAGRAM || 0}
                  </span>
                </button>
              </div>
            </div>
          )}
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
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition duration-150 shrink-0 ${isTabActive
                ? "border-[#25D366] text-[#075E54]"
                : "border-transparent text-[#667781] hover:text-[#111B21] hover:border-emerald-200"
                }`}
            >
              <span>{tab.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-full text-[9px] font-bold leading-none ${isTabActive
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
                className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-[#F0F2F5] transition ${isActive ? "bg-[#F0F2F5]" : "hover:bg-[#F5F6F6] bg-white"
                  } ${bulkSelectMode && selectedConvIds.includes(chat.id)
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
                      handleSelectChat(chat.id);
                    }
                  }}
                >
                  <div className="relative shrink-0">
                    {chat.contact?.avatarUrl ? (
                      <img
                        src={getAvatarUrl(chat.contact.avatarUrl)}
                        alt={contactName}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${avatarBg}`}
                      >
                        {contactName.charAt(0)}
                      </div>
                    )}

                    {/* Platform Badge (Bottom-Right) */}
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                      {(chat.channel === "WHATSAPP" || !chat.channel) && (
                        <span className="w-full h-full rounded-full bg-[#25D366] flex items-center justify-center text-white text-[10px]">
                          <FaWhatsapp />
                        </span>
                      )}
                      {chat.channel === "MESSENGER" && (
                        <span className="w-full h-full rounded-full bg-[#0084FF] flex items-center justify-center text-white text-[10px]">
                          <FaFacebookMessenger />
                        </span>
                      )}
                      {chat.channel === "INSTAGRAM" && (
                        <span className="w-full h-full rounded-full bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] flex items-center justify-center text-white text-[10px]">
                          <FaInstagram />
                        </span>
                      )}
                    </span>
                  </div>

                                       <div className="flex-1 min-w-0">
                    {/* Name on Left, Time + Pin Icon on Right */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`text-sm truncate max-w-[170px] ${
                          unreadCount > 0
                            ? "font-bold text-[#111B21]"
                            : "font-semibold text-[#111B21]"
                        }`}
                      >
                        {contactName}
                      </span>

                      {/* Timestamp + Pin Icon */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] ${
                            unreadCount > 0
                              ? "text-[#25D366] font-semibold"
                              : "text-[#667781]"
                          }`}
                        >
                          {timeStr}
                        </span>
                        {chat.isPinned && (
                          <Pin className="w-3 h-3 text-[#667781] fill-[#667781] rotate-45 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Message Preview + Unread Count */}
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
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bg-gray-100">
              {selectedChannel === "WHATSAPP" && <FaWhatsapp className="w-8 h-8 text-[#25D366]" />}
              {selectedChannel === "MESSENGER" && <FaFacebookMessenger className="w-8 h-8 text-[#0084FF]" />}
              {selectedChannel === "INSTAGRAM" && <FaInstagram className="w-8 h-8 text-[#E1306C]" />}
              {selectedChannel === "ALL" && <MessageSquarePlus className="w-8 h-8 text-gray-400" />}
            </div>
            <p className="text-sm font-semibold text-[#111B21]">
              No {selectedChannel === "ALL" ? "" : selectedChannel.toLowerCase()} conversations yet
            </p>
            <p className="text-xs text-[#667781] mt-1 max-w-xs">
              When customers message your {selectedChannel === "ALL" ? "channels" : selectedChannel.toLowerCase()} account, conversations will appear here in real time.
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
  );
}
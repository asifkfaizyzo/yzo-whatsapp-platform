import React from "react";
import {
  X,
  FileText,
  ChevronRight,
  ExternalLink,
  PhoneCall,
  PhoneOutgoing,
  PhoneIncoming,
  Phone,
  Mail,
  Building2,
  Pin,
  UserCheck,
  Tag,
  CalendarDays,
  ChevronLeft,
  RefreshCw,
  Paperclip,
  Eye,
} from "lucide-react";
import ContactCallsDrawer from "../ContactCallsDrawer";

export default function ContactPanel({
  activeChat,
  showContactPanel,
  setShowContactPanel,
  rightPanelSubView,
  setRightPanelSubView,
  mediaActiveTab,
  setMediaActiveTab,
  mediaCategoryCounts,
  mediaItems,
  loadingMediaItems,
  activeChatCalls,
  loadingCalls,
  userRole,
  allAgents,
  selectedAgent,
  setSelectedAgent,
  handleAssignAgent,
  assigningUser,
  allTags,
  selectedTag,
  setSelectedTag,
  handleAssignTag,
  assigningTag,
  handleRemoveTag,
  handleTogglePin,
  getAvatarStyle,
  getAvatarUrl,
  getMediaUrl,
  formatDate,
  setPreviewImageModal,
  activeChatId,
  loadConversationCalls,
  handleInitiateCall,
}) {
  if (!activeChat) return null;

  return (
    <div
      className={`border-l border-emerald-100 flex flex-col overflow-y-auto shrink-0 bg-white transition-all duration-300 ease-in-out ${
        showContactPanel ? "w-72 opacity-100" : "w-0 opacity-0 border-l-0"
      }`}
    >
      {/* ──────────────────────────────────────────
          SUB-VIEW 1: CONTACT INFO
      ────────────────────────────────────────── */}
      {rightPanelSubView === "info" && (
        <>
          {/* Profile Header */}
          <div className="bg-gradient-to-b from-[#075E54] to-[#128C7E] px-6 pt-6 pb-8 flex flex-col items-center text-center relative">
            <button
              onClick={() => setShowContactPanel(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
              title="Close panel"
            >
              <X size={16} />
            </button>

            {activeChat.contact?.avatarUrl ? (
              <img
                src={getAvatarUrl(activeChat.contact.avatarUrl)}
                alt={activeChat.contact?.name || "Customer"}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white/20 shadow-lg mb-3"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-xl ring-4 ring-white/20 shadow-lg mb-3 ${getAvatarStyle(
                  activeChat.contact?.name
                )}`}
              >
                {(activeChat.contact?.name || "C").charAt(0)}
              </div>
            )}
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
            {/* ── WhatsApp-Style "Media, links and docs" Section Card ── */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5 space-y-2">
              <button
                onClick={() => {
                  setRightPanelSubView("media");
                  setMediaActiveTab("media");
                }}
                className="w-full flex items-center justify-between group text-left"
              >
                <span className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={11} /> Media, links and docs
                </span>
                <div className="flex items-center gap-1 text-[#667781] group-hover:text-[#075E54] transition">
                  <span className="text-[11px] font-bold">
                    {mediaCategoryCounts.media + mediaCategoryCounts.docs + mediaCategoryCounts.links}
                  </span>
                  <ChevronRight size={13} />
                </div>
              </button>

              {/* Thumbnail Row */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
                {mediaCategoryCounts.media + mediaCategoryCounts.docs + mediaCategoryCounts.links === 0 ? (
                  <p className="text-[10px] text-[#667781] italic">No media shared yet</p>
                ) : (
                  mediaItems.slice(0, 4).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      onClick={() => {
                        setRightPanelSubView("media");
                        setMediaActiveTab(item.type === "FILE" ? "docs" : item.links?.length > 0 ? "links" : "media");
                      }}
                      className="w-12 h-12 rounded-xl bg-white border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition shadow-2xs"
                    >
                      {item.type === "IMAGE" && item.mediaUrl ? (
                        <img src={getMediaUrl(item.mediaUrl)} alt="" className="w-full h-full object-cover" />
                      ) : item.type === "VIDEO" ? (
                        <div className="text-[#075E54] text-[10px] font-bold">🎥 Video</div>
                      ) : item.type === "FILE" ? (
                        <FileText size={16} className="text-[#075E54]" />
                      ) : (
                        <ExternalLink size={14} className="text-[#075E54]" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── WhatsApp-Style "Calls & Recordings" Section Card ── */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5 space-y-2">
              <button
                onClick={() => setRightPanelSubView("calls")}
                className="w-full flex items-center justify-between group text-left"
              >
                <span className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall size={11} /> Calls & Recordings
                </span>
                <div className="flex items-center gap-1 text-[#667781] group-hover:text-[#075E54] transition">
                  <span className="text-[11px] font-bold text-[#075E54]">
                    {activeChatCalls.length}
                  </span>
                  <ChevronRight size={13} />
                </div>
              </button>

              {activeChatCalls.length === 0 ? (
                <p className="text-[10px] text-[#667781] italic">No calls yet</p>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#111B21]">
                    {activeChatCalls[activeChatCalls.length - 1].direction === "BUSINESS_INITIATED" ? (
                      <PhoneOutgoing size={13} className="text-[#075E54]" />
                    ) : (
                      <PhoneIncoming size={13} className="text-[#075E54]" />
                    )}
                    <span className="text-[11px] font-medium text-[#111B21]">
                      Latest: {activeChatCalls[activeChatCalls.length - 1].duration ? `${activeChatCalls[activeChatCalls.length - 1].duration}s` : activeChatCalls[activeChatCalls.length - 1].status}
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelSubView("calls")}
                    className="text-[10px] text-[#075E54] font-bold hover:underline"
                  >
                    View All
                  </button>
                </div>
              )}
            </div>

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

            {/* ⭐ Pin / Unpin Chat Card ⭐ */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                  <Pin size={11} className={activeChat?.isPinned ? "rotate-45 fill-[#075E54]" : ""} /> Chat Pin
                </span>
                <button
                  type="button"
                  onClick={(e) => handleTogglePin(e, activeChat?.id)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                    activeChat?.isPinned
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                      : "bg-white text-[#111B21] border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {activeChat?.isPinned ? "Unpin Chat" : "Pin Chat"}
                </button>
              </div>
            </div>

            {/* Agent */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck size={11} /> Agent
                </p>
                <span className="text-[10px] font-semibold text-[#111B21]">
                  {activeChat.contact?.assignedTo ? (
                    allAgents.find(
                      (a) => a.id === activeChat.contact?.assignedTo
                    )?.name || "Assigned"
                  ) : (
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
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold border ${getAvatarStyle(
                      ct.tag?.name // Reusing getAvatarStyle for tags (might need a dedicated getTagColor but passing getAvatarStyle for now or replace with getTagColor)
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
                  {formatDate(activeChat.createdAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="h-px bg-emerald-100" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#667781]">Last Activity</span>
                <span className="text-[10px] text-[#111B21] font-semibold">
                  {formatDate(activeChat.updatedAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ──────────────────────────────────────────
          SUB-VIEW 2: MEDIA, LINKS & DOCS DRAWER
      ────────────────────────────────────────── */}
      {rightPanelSubView === "media" && (
        <div className="flex flex-col h-full bg-white animate-in slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className="p-4 bg-[#075E54] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRightPanelSubView("info")}
                className="p-1 rounded-lg hover:bg-white/10 transition text-white"
                title="Back to Contact Info"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs font-bold tracking-wide">
                Media, links and docs
              </span>
            </div>
            <button
              onClick={() => setShowContactPanel(false)}
              className="p-1 rounded-lg hover:bg-white/10 transition text-white/70 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* 3 Tabs Header */}
          <div className="flex items-center border-b border-slate-200 bg-[#F0F2F5] shrink-0">
            <button
              onClick={() => setMediaActiveTab("media")}
              className={`flex-1 py-2.5 text-center text-[11px] font-bold border-b-2 transition ${
                mediaActiveTab === "media"
                  ? "border-[#075E54] text-[#075E54] bg-white"
                  : "border-transparent text-[#667781] hover:text-[#111B21]"
              }`}
            >
              Media ({mediaCategoryCounts.media})
            </button>

            <button
              onClick={() => setMediaActiveTab("docs")}
              className={`flex-1 py-2.5 text-center text-[11px] font-bold border-b-2 transition ${
                mediaActiveTab === "docs"
                  ? "border-[#075E54] text-[#075E54] bg-white"
                  : "border-transparent text-[#667781] hover:text-[#111B21]"
              }`}
            >
              Docs ({mediaCategoryCounts.docs})
            </button>

            <button
              onClick={() => setMediaActiveTab("links")}
              className={`flex-1 py-2.5 text-center text-[11px] font-bold border-b-2 transition ${
                mediaActiveTab === "links"
                  ? "border-[#075E54] text-[#075E54] bg-white"
                  : "border-transparent text-[#667781] hover:text-[#111B21]"
              }`}
            >
              Links ({mediaCategoryCounts.links})
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingMediaItems ? (
              <div className="flex items-center justify-center py-12 text-xs text-[#667781] gap-2">
                <RefreshCw size={14} className="animate-spin text-[#25D366]" />
                <span>Loading...</span>
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText size={28} className="text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No {mediaActiveTab} shared</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Attachments shared in this chat will appear here
                </p>
              </div>
            ) : (
              <>
                {/* TAB 1: MEDIA GRID (Photos, Videos, Audios) */}
                {mediaActiveTab === "media" && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {mediaItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          setPreviewImageModal({
                            type: item.type,
                            url: getMediaUrl(item.mediaUrl),
                            name: item.mediaName,
                            caption: item.caption,
                          })
                        }
                        className="aspect-square bg-slate-100 rounded-xl overflow-hidden relative cursor-pointer group border border-slate-200 hover:opacity-90 transition shadow-2xs"
                      >
                        {item.type === "IMAGE" && item.mediaUrl ? (
                          <img
                            src={getMediaUrl(item.mediaUrl)}
                            alt={item.mediaName || "Media"}
                            className="w-full h-full object-cover"
                          />
                        ) : item.type === "VIDEO" ? (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white text-[9px] font-bold">
                            🎥 Video
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-[#075E54] text-[9px] font-bold">
                            🎵 Audio
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 2: DOCUMENTS */}
                {mediaActiveTab === "docs" && (
                  <div className="space-y-2">
                    {mediaItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          setPreviewImageModal({
                            type: "FILE",
                            url: getMediaUrl(item.mediaUrl),
                            name: item.mediaName,
                            caption: item.caption,
                          })
                        }
                        className="p-2.5 rounded-xl border border-slate-200 bg-[#F0F2F5] hover:bg-emerald-50 transition cursor-pointer flex items-center gap-2.5 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#075E54]/10 text-[#075E54] flex items-center justify-center shrink-0">
                          <Paperclip size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[#111B21] truncate group-hover:text-[#075E54]">
                            {item.mediaName || "Document"}
                          </p>
                          <p className="text-[9px] text-[#667781]">
                            {item.mediaSize
                              ? item.mediaSize < 1024 * 1024
                                ? (item.mediaSize / 1024).toFixed(1) + " KB"
                                : (item.mediaSize / (1024 * 1024)).toFixed(1) + " MB"
                              : "Document"}{" "}
                            • {formatDate(item.createdAt, { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <Eye size={15} className="text-[#075E54] shrink-0 opacity-70 group-hover:opacity-100" />
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: LINKS */}
                {mediaActiveTab === "links" && (
                  <div className="space-y-2">
                    {mediaItems.map((item) => {
                      const links = item.links && item.links.length > 0 ? item.links : [item.text];
                      return links.map((linkUrl, idx) => (
                        <a
                          key={`${item.id}-${idx}`}
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl border border-slate-200 bg-[#F0F2F5] hover:bg-emerald-50 transition block group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <ExternalLink size={13} className="text-[#075E54] shrink-0" />
                            <span className="text-[11px] font-bold text-[#075E54] truncate group-hover:underline">
                              {linkUrl}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#111B21] line-clamp-2 leading-relaxed">
                            {item.text}
                          </p>
                          <p className="text-[8px] text-[#667781] mt-1">
                            {formatDate(item.createdAt, { month: "short", day: "numeric" })}
                          </p>
                        </a>
                      ));
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────
          SUB-VIEW 3: CALLS & RECORDINGS DRAWER
      ────────────────────────────────────────── */}
      {rightPanelSubView === "calls" && (
        <ContactCallsDrawer
          contact={activeChat.contact}
          calls={activeChatCalls}
          loading={loadingCalls}
          onBack={() => setRightPanelSubView("info")}
          onInitiateCall={() => handleInitiateCall(activeChat.contact)}
          onRefresh={() => loadConversationCalls(activeChatId)}
        />
      )}
    </div>
  );
}

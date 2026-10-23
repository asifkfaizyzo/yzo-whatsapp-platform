import React from 'react';
import { Paperclip, Smile, Send, Mic, X, MapPin } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import QuickReplyPopover from "../QuickReplyPopover";

export default function ChatInput({
  handleSendMessage,
  activeChat,
  handleUpdateStatus,
  stagedQuickReply,
  setStagedQuickReply,
  emojiPickerRef,
  showEmojiPicker,
  setShowEmojiPicker,
  handleEmojiClick,
  fileInputRef,
  handleFileSelect,
  documentInputRef,
  photoVideoInputRef,
  audioInputRef,
  cameraInputRef,
  attachMenuRef,
  showAttachMenu,
  setShowAttachMenu,
  handleAttachMenuClick,
  showQuickReplyPopover,
  filteredQuickReplies,
  quickReplySelectedIndex,
  handleSelectQuickReply,
  setShowQuickReplyPopover,
  user,
  typedMessage,
  setQuickReplySelectedIndex,
  setFilteredQuickReplies,
  setTypedMessage,
  quickRepliesList,
  socket,
  activeChatId,
  isTypingRef,
  typingTimeoutRef,
  isRecording,
  recordingTime,
  handleCancelRecording,
  handleStopRecording,
  handleStartRecording,
}) {
  return (
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

      {/* ── Staged Quick Reply Attachment Preview ── */}
      {stagedQuickReply && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-[#075E54] shadow-xs animate-in fade-in slide-in-from-bottom-1">
          <Paperclip size={14} className="shrink-0 text-[#075E54]" />
          <span className="font-semibold">Attached with Quick Reply:</span>
          <span className="truncate max-w-xs font-medium text-slate-800">
            {stagedQuickReply.mediaName || "Attachment"}
          </span>
          {stagedQuickReply.mediaSize && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({(stagedQuickReply.mediaSize / 1024).toFixed(0)} KB)
            </span>
          )}
          <button
            type="button"
            onClick={() => setStagedQuickReply(null)}
            className="ml-auto rounded-full p-1 text-slate-400 hover:bg-emerald-100 hover:text-red-500 transition"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-center gap-2">
        {/* ── Emoji Picker Button ── */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            disabled={activeChat.contact?.isBlocked}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
            title="Emoji"
          >
            <Smile size={22} />
          </button>

          {/* Emoji Picker Popup - Ultra Compact */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={260}
                height={320}
                searchDisabled={false}
                skinTonesDisabled={true}
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis={true}
                emojiStyle="native"
                style={{
                  fontSize: "12px",
                  "--epr-emoji-size": "20px",
                  "--epr-category-navigation-button-size": "24px",
                  "--epr-header-padding": "8px",
                  "--epr-search-input-height": "32px",
                  "--epr-emoji-padding": "4px",
                  "--epr-category-label-height": "24px",
                }}
              />
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,video/mp4,audio/mpeg,audio/ogg"
          onChange={handleFileSelect}
        />

        {/* ── WhatsApp-Style Hidden File Inputs ── */}
        <input
          type="file"
          ref={documentInputRef}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={photoVideoInputRef}
          className="hidden"
          accept="image/*,video/*"
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={audioInputRef}
          className="hidden"
          accept="audio/*"
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={cameraInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
        />

        {/* ── NEW WhatsApp-Style Attach Button with Menu ── */}
        <div className="relative" ref={attachMenuRef}>
          <button
            type="button"
            disabled={activeChat.contact?.isBlocked}
            onClick={() => setShowAttachMenu((prev) => !prev)}
            className="text-[#54656F] hover:text-[#075E54] p-2 rounded-full hover:bg-white transition disabled:opacity-50"
            title="Attach"
          >
            <Paperclip size={20} className="rotate-45" />
          </button>

          {/* ── Popup Attach Menu - Compact ── */}
          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-xl shadow-2xl border border-emerald-100 overflow-hidden min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Document */}
              <button
                type="button"
                onClick={() => handleAttachMenuClick("document")}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
              >
                <div className="w-7 h-7 rounded-full bg-[#7F66FF]/10 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F66FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-[#111B21]">Document</span>
              </button>

              {/* Photos & Videos */}
              <button
                type="button"
                onClick={() => handleAttachMenuClick("photos")}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
              >
                <div className="w-7 h-7 rounded-full bg-[#007BFC]/10 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007BFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-[#111B21]">Photos & videos</span>
              </button>

              {/* Audio */}
              <button
                type="button"
                onClick={() => handleAttachMenuClick("audio")}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
              >
                <div className="w-7 h-7 rounded-full bg-[#F7943D]/10 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F7943D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-[#111B21]">Audio</span>
              </button>

              {/* Location */}
              <button
                type="button"
                onClick={() => handleAttachMenuClick("location")}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F2F5] transition text-left"
              >
                <div className="w-7 h-7 rounded-full bg-[#00A884]/10 flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-[#00A884]" />
                </div>
                <span className="text-xs font-medium text-[#111B21]">Location</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative flex-1 flex items-center">
          {showQuickReplyPopover && (
            <QuickReplyPopover
              quickReplies={filteredQuickReplies}
              selectedIndex={quickReplySelectedIndex}
              onSelect={handleSelectQuickReply}
              onClose={() => setShowQuickReplyPopover(false)}
              contact={activeChat?.contact}
              user={user}
            />
          )}

          {!isRecording ? (
            <input
              type="text"
              placeholder={
                activeChat.contact?.isBlocked
                  ? "Cannot send messages to a blocked contact"
                  : ["RESOLVED", "CLOSED"].includes(activeChat.status)
                    ? "Type a message to reopen chat... (or type / for quick replies)"
                    : "Type a message (or type / for quick replies)"
              }
              value={typedMessage}
              disabled={activeChat.contact?.isBlocked}
              onKeyDown={(e) => {
                if (showQuickReplyPopover && filteredQuickReplies.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setQuickReplySelectedIndex((prev) => (prev + 1) % filteredQuickReplies.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setQuickReplySelectedIndex((prev) => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    handleSelectQuickReply(filteredQuickReplies[quickReplySelectedIndex]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setShowQuickReplyPopover(false);
                    return;
                  }
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                setTypedMessage(val);

                // Slash command trigger detection
                if (val.startsWith("/")) {
                  const query = val.replace(/^\/+/, "").toLowerCase().trim();
                  const matched = quickRepliesList.filter((qr) => {
                    return (
                      qr.isActive &&
                      (qr.shortcut.toLowerCase().includes(query) ||
                       qr.title.toLowerCase().includes(query) ||
                       qr.content.toLowerCase().includes(query))
                    );
                  });

                  if (matched.length > 0) {
                    setFilteredQuickReplies(matched);
                    setQuickReplySelectedIndex(0);
                    setShowQuickReplyPopover(true);
                  } else {
                    setShowQuickReplyPopover(false);
                  }
                } else {
                  setShowQuickReplyPopover(false);
                }

                if (socket && activeChatId) {
                  if (val.trim().length > 0) {
                    if (!isTypingRef.current) {
                      isTypingRef.current = true;
                      socket.emit("agent_typing_start", { conversationId: activeChatId });
                    }
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      isTypingRef.current = false;
                      socket.emit("agent_typing_stop", { conversationId: activeChatId });
                    }, 2500);
                  } else {
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    isTypingRef.current = false;
                    socket.emit("agent_typing_stop", { conversationId: activeChatId });
                  }
                }
              }}
              className="w-full py-2.5 px-4 bg-white rounded-lg border-0 text-sm text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 disabled:bg-[#F0F2F5] disabled:text-[#667781] disabled:cursor-not-allowed transition"
            />
          ) : (
            <div className="w-full flex items-center gap-2 py-2.5 px-4 bg-white rounded-lg">
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
        </div>

        {activeChat?.channel === "INSTAGRAM" && (
          <span
            className={`text-[10px] font-medium mr-1 ${new TextEncoder().encode(typedMessage).length > 900
              ? "text-red-500 font-bold"
              : "text-[#667781]"
              }`}
          >
            {new TextEncoder().encode(typedMessage).length}/1000 bytes
          </span>
        )}

        {typedMessage.trim() ? (
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
  );
}
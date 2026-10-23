import React from 'react';
import { X, FileText, Smile, RefreshCw, Send } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

export default function MediaStagingOverlay({
  selectedFile,
  handleCancelFile,
  filePreview,
  stagingEmojiPickerRef,
  showStagingEmojiPicker,
  setShowStagingEmojiPicker,
  handleStagingEmojiClick,
  fileCaption,
  setFileCaption,
  handleSendFile,
  uploadingFile
}) {
  return (
    <>
        {/* ── Media Staging Overlay (WhatsApp Web Style) ── */}
        {selectedFile && (
          <div className="absolute inset-0 z-40 bg-[#0B141A]/95 backdrop-blur-md flex flex-col animate-in fade-in duration-150">
            {/* Top Bar: Discard + File Info */}
            <div className="h-14 px-5 flex items-center justify-between border-b border-white/10 text-white shrink-0 bg-[#111B21]">
              <button
                type="button"
                onClick={handleCancelFile}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Discard (Esc)"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 max-w-md truncate">
                <span className="text-sm font-semibold text-white truncate">
                  {selectedFile.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 shrink-0 font-mono">
                  {selectedFile.size < 1024 * 1024
                    ? (selectedFile.size / 1024).toFixed(1) + " KB"
                    : (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB"}
                </span>
              </div>

              <div className="w-9" />
            </div>

            {/* Media Preview Canvas */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative select-none">
              {filePreview && selectedFile.type?.startsWith("image/") ? (
                <img
                  src={filePreview}
                  alt="Preview"
                  className="max-h-[55vh] max-w-[90%] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                />
              ) : filePreview && selectedFile.type?.startsWith("video/") ? (
                <video
                  src={filePreview}
                  controls
                  autoPlay
                  className="max-h-[55vh] max-w-[90%] rounded-2xl shadow-2xl ring-1 ring-white/10"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-[#111B21]/90 border border-white/10 rounded-2xl max-w-sm w-full text-center shadow-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-[#075E54]/30 text-[#25D366] flex items-center justify-center mb-4 shadow-inner">
                    <FileText size={32} />
                  </div>
                  <p className="text-sm font-semibold text-white truncate max-w-xs mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                    {selectedFile.name.split(".").pop() || "Document"} •{" "}
                    {selectedFile.size < 1024 * 1024
                      ? (selectedFile.size / 1024).toFixed(1) + " KB"
                      : (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB"}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    No preview available for this file type
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Caption & Send Bar */}
            <div className="p-4 bg-[#111B21] border-t border-white/10 flex items-center gap-3 shrink-0">
              {/* Emoji Picker */}
              <div className="relative" ref={stagingEmojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowStagingEmojiPicker((prev) => !prev)}
                  className="text-slate-400 hover:text-white p-2.5 rounded-full hover:bg-white/10 transition"
                  title="Emoji"
                >
                  <Smile size={22} />
                </button>

                {showStagingEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-3 z-50 shadow-2xl rounded-2xl overflow-hidden border border-white/10">
                    <EmojiPicker
                      onEmojiClick={handleStagingEmojiClick}
                      width={280}
                      height={340}
                      searchDisabled={false}
                      skinTonesDisabled={true}
                      previewConfig={{ showPreview: false }}
                      lazyLoadEmojis={true}
                      emojiStyle="native"
                      theme="dark"
                    />
                  </div>
                )}
              </div>

              {/* Single Caption Input */}
              <input
                type="text"
                autoFocus
                placeholder="Add a caption..."
                value={fileCaption}
                onChange={(e) => setFileCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendFile();
                  }
                }}
                className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/15 focus:border-[#25D366] rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
              />

              {/* Single Send Button */}
              <button
                type="button"
                onClick={handleSendFile}
                disabled={uploadingFile}
                className="w-11 h-11 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/40 active:scale-95 transition disabled:opacity-50"
                title="Send (Enter)"
              >
                {uploadingFile ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Send size={18} className="ml-0.5" />
                )}
              </button>
            </div>
          </div>
        )}
    </>
  );
}
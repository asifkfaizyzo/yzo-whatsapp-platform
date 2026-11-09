// tenant-web/src/pages/Inbox/comps/modals/ArchivedChatsModal.jsx (do not remove this comment)

import React from "react";
import { X, RefreshCw, Archive } from "lucide-react";

/**
 * Modal listing archived conversations with unarchive action.
 * Extracted from inline JSX in original Inbox.jsx.
 *
 * NOTE: Original used inline SVGs for the archive icon.
 * Replaced with Lucide <Archive /> per project convention.
 */
export default function ArchivedChatsModal({
  showArchived,
  setShowArchived,
  archivedChats,
  loadingArchived,
  unarchivingId,
  handleUnarchiveConversation,
  getAvatarStyle,
  formatDate,
  formatLastMessagePreview,
}) {
  if (!showArchived) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#075E54] flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <Archive size={16} className="text-white" />
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
                <Archive size={24} className="text-[#667781]" />
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
            archivedChats.map((chat, archIdx) => {
              const contactName = chat.contact?.name || "Unknown";
              const lastMsg = chat.messages?.[0];
              const isUnarchiving = unarchivingId === chat.id;
              const archivedDate = formatDate(chat.archivedAt, {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={chat.id || `archived-${archIdx}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5F6F6] transition"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarStyle(
                      contactName,
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
                      {formatLastMessagePreview(lastMsg)}
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
                    onClick={() =>
                      handleUnarchiveConversation(chat.id)
                    }
                    disabled={isUnarchiving}
                    title="Unarchive this conversation"
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-[#075E54] hover:bg-[#064E47] text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50"
                  >
                    {isUnarchiving ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <>
                        <Archive size={11} />
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
  );
}
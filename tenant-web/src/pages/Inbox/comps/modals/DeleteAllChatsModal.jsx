// tenant-web/src/pages/Inbox/comps/modals/DeleteAllChatsModal.jsx (do not remove this comment)

import React from "react";
import { Trash2, RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Admin-only confirmation modal to delete all conversations.
 * Extracted from inline JSX in original Inbox.jsx.
 *
 * EMOJI FIX: Replaced "⚠️" in warning text with <AlertTriangle /> icon.
 */
export default function DeleteAllChatsModal({
  showDeleteAllConfirm,
  setShowDeleteAllConfirm,
  chatCount,
  deletingAllChats,
  handleDeleteAllChats,
  userRole,
}) {
  if (!showDeleteAllConfirm || userRole !== "admin") return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-red-100 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 bg-red-500 flex items-center gap-2.5 rounded-t-3xl">
          <Trash2 size={16} className="text-white" />
          <h2 className="text-base font-bold text-white">
            Delete All Chats
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-[#111B21] font-medium mb-1">
            Delete all {chatCount} conversation(s)?
          </p>
          <p className="text-xs text-[#667781] mb-6 flex items-start gap-1.5">
            <AlertTriangle
              size={14}
              className="text-amber-500 shrink-0 mt-0.5"
            />
            <span>
              This will permanently delete all messages from all chats.
              This action cannot be undone.
            </span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteAllConfirm(false)}
              disabled={deletingAllChats}
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAllChats}
              disabled={deletingAllChats}
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deletingAllChats ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete All"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
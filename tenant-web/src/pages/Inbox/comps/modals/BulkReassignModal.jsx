// tenant-web/src/pages/Inbox/comps/modals/BulkReassignModal.jsx (do not remove this comment)

import React from "react";
import { X } from "lucide-react";

/**
 * Modal for bulk-reassigning selected conversations to an agent.
 * Extracted from inline JSX in original Inbox.jsx.
 */
export default function BulkReassignModal({
  showBulkReassignModal,
  setShowBulkReassignModal,
  selectedConvIds,
  bulkTargetUserId,
  setBulkTargetUserId,
  allAgents,
  bulkReassigning,
  handleBulkReassign,
}) {
  if (!showBulkReassignModal) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="px-6 py-4 bg-[#075E54] text-white flex justify-between items-center">
          <h2 className="font-bold">
            Bulk Reassign ({selectedConvIds.length})
          </h2>
          <button onClick={() => setShowBulkReassignModal(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[#075E54] uppercase">
              Assign To
            </label>
            <select
              className="w-full mt-1 border rounded-xl p-2 text-sm"
              value={bulkTargetUserId}
              onChange={(e) => setBulkTargetUserId(e.target.value)}
            >
              <option value="">— Unassign —</option>
              {allAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              className="flex-1 py-2 bg-gray-100 rounded-xl text-sm"
              onClick={() => setShowBulkReassignModal(false)}
            >
              Cancel
            </button>
            <button
              className="flex-1 py-2 bg-[#075E54] text-white rounded-xl text-sm font-bold disabled:opacity-50"
              disabled={bulkReassigning}
              onClick={handleBulkReassign}
            >
              {bulkReassigning ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
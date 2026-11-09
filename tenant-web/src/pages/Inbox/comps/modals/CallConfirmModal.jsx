// tenant-web/src/pages/Inbox/comps/modals/CallConfirmModal.jsx (do not remove this comment)

import React from "react";
import { Phone } from "lucide-react";

/**
 * Confirmation modal shown after permission check passes.
 * Asks the agent to confirm before initiating the WebRTC call.
 * Extracted from inline JSX in original Inbox.jsx.
 */
export default function CallConfirmModal({
  showInitiateCallConfirmModal,
  setShowInitiateCallConfirmModal,
  pendingCallContact,
  setPendingCallContact,
  handleInitiateCall,
}) {
  if (!showInitiateCallConfirmModal || !pendingCallContact) return null;

  const handleClose = () => {
    setShowInitiateCallConfirmModal(false);
    setPendingCallContact(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-10 h-10 rounded-full bg-blue-50 text-[#125EF2] flex items-center justify-center mb-3">
          <Phone size={20} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Start WhatsApp Call
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to call{" "}
          <span className="font-semibold text-gray-800">
            {pendingCallContact.name || pendingCallContact.phone}
          </span>
          ?
        </p>
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const contactToCall = pendingCallContact;
              handleClose();
              handleInitiateCall(contactToCall);
            }}
            className="flex-1 px-4 py-2.5 flex items-center justify-center gap-2 bg-[#125EF2] hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            <Phone size={14} /> Call Now
          </button>
        </div>
      </div>
    </div>
  );
}
// tenant-web/src/pages/Inbox/comps/modals/CallPermissionModal.jsx (do not remove this comment)

import React from "react";
import { Phone } from "lucide-react";

/**
 * Shown when an agent tries to call a contact who hasn't granted
 * call permission yet. Offers to send a permission request.
 * Extracted from inline JSX in original Inbox.jsx.
 */
export default function CallPermissionModal({
  showCallPermissionModal,
  setShowCallPermissionModal,
  pendingCallContact,
  setPendingCallContact,
  handleRequestCallPermission,
}) {
  if (!showCallPermissionModal || !pendingCallContact) return null;

  const handleClose = () => {
    setShowCallPermissionModal(false);
    setPendingCallContact(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
          <Phone size={20} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Permission Needed
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Calling permission is required before you can call{" "}
          <span className="font-semibold text-gray-800">
            {pendingCallContact.name || pendingCallContact.phone}
          </span>
          . Would you like to request permission now?
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
              handleRequestCallPermission(pendingCallContact);
              handleClose();
            }}
            className="flex-1 px-4 py-2.5 bg-[#25D366] hover:bg-[#22C55E] text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            Request Permission
          </button>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import {
  Phone,
  CheckCircle2,
  RefreshCw,
  MoreVertical,
  Trash2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from "react-icons/fa";

export default function ChatHeader({
  activeChat,
  getAvatarUrl,
  getAvatarStyle,
  activeViewers,
  user,
  handleRequestCallPermission,
  handleInitiateCall,
  handleUpdateStatus,
  showConvMenu,
  setShowConvMenu,
  handleArchiveConversation,
  archivingConv,
  userRole,
  showDeleteConfirm,
  setShowDeleteConfirm,
  showContactPanel,
  setShowContactPanel,
  is24hExpired,
  typingAgents,
  deletingConv,
  handleDeleteConversation,
  convMenuRef,
}) {
  return (
    <>
      {/* Chat Header */}
      <div className="bg-[#075E54] px-5 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {activeChat.contact?.avatarUrl ? (
              <img
                src={getAvatarUrl(activeChat.contact.avatarUrl)}
                alt={activeChat.contact?.name || "Customer"}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-white/20 ${getAvatarStyle(
                  activeChat.contact?.name,
                )}`}
              >
                {(activeChat.contact?.name || "C").charAt(0)}
              </div>
            )}
            {/* Platform Badge */}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white shadow-xs">
              {(activeChat.channel === "WHATSAPP" || !activeChat.channel) && (
                <span className="w-full h-full rounded-full bg-[#25D366] flex items-center justify-center text-white text-[8px]">
                  <FaWhatsapp />
                </span>
              )}
              {activeChat.channel === "MESSENGER" && (
                <span className="w-full h-full rounded-full bg-[#0084FF] flex items-center justify-center text-white text-[8px]">
                  <FaFacebookMessenger />
                </span>
              )}
              {activeChat.channel === "INSTAGRAM" && (
                <span className="w-full h-full rounded-full bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] flex items-center justify-center text-white text-[8px]">
                  <FaInstagram />
                </span>
              )}
            </span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none flex items-center gap-1.5">
              {activeChat.contact?.name || (activeChat.contact?.username ? `@${activeChat.contact.username}` : "Customer")}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <p className="text-[10px] text-emerald-200 font-medium">
                {activeChat.channel === "INSTAGRAM"
                  ? `via Instagram DM • @${activeChat.contact?.username || activeChat.contact?.name || "user"}`
                  : activeChat.channel === "MESSENGER"
                    ? `via Facebook Messenger`
                    : `via WhatsApp • ${activeChat.contact?.phone || ""}`}
              </p>
              {activeViewers.filter((v) => String(v.userId) !== String(user?.id)).length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#064E47] text-emerald-100 text-[10px] font-medium border border-emerald-400/30 ml-2 shadow-sm">
                  <Eye size={11} className="text-emerald-300" />
                  <span>
                    {activeViewers
                      .filter((v) => String(v.userId) !== String(user?.id))
                      .map((v) => v.name)
                      .join(", ")}{" "}
                    viewing
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>



        <div className="flex items-center gap-2">

          {activeChat.channel === "WHATSAPP" && (
              <>
                <button
                  onClick={() => handleRequestCallPermission(activeChat.contact)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/40 backdrop-blur-sm border border-yellow-500/30 rounded-xl text-white text-xs font-semibold transition duration-150 mr-2"
                  title="Request Call Permission"
                >
                  <span>Ask Permission</span>
                </button>
                <button
                  onClick={() => handleInitiateCall(activeChat.contact)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#125EF2]/20 hover:bg-[#125EF2]/40 backdrop-blur-sm border border-[#125EF2]/30 rounded-xl text-white text-xs font-semibold transition duration-150 mr-2"
                  title="Initiate WhatsApp Call"
                >
                  <Phone size={13} className="text-blue-100" />
                  <span>Call</span>
                </button>
              </>
            )}
            {activeChat.status === "OPEN" ? (
            <button
              onClick={() => handleUpdateStatus("RESOLVED")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/10 rounded-xl text-white text-xs font-semibold transition duration-150"
              title="Mark as Resolved"
            >
              <CheckCircle2 size={13} />
              <span>Resolve</span>
            </button>
          ) : (
            <button
              onClick={() => handleUpdateStatus("OPEN")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#22C55E] border border-[#25D366] rounded-xl text-white text-xs font-semibold transition duration-150"
              title="Reopen conversation"
            >
              <RefreshCw size={13} />
              <span>Reopen</span>
            </button>
          )}

          {/* Conv Menu */}
          <div className="relative" ref={convMenuRef}>
            <button
              onClick={() => setShowConvMenu((prev) => !prev)}
              className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
            >
              <MoreVertical size={18} />
            </button>

            {showConvMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-emerald-100 overflow-hidden w-44">
                <button
                  onClick={handleArchiveConversation}
                  disabled={archivingConv}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#111B21] hover:bg-[#F0F2F5] transition disabled:opacity-50"
                >
                  {archivingConv ? (
                    <RefreshCw
                      size={14}
                      className="animate-spin text-[#075E54]"
                    />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#075E54"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="21 8 21 21 3 21 3 8" />
                      <rect x="1" y="3" width="22" height="5" />
                      <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                  )}
                  <span>Archive Chat</span>
                </button>

                {userRole === "admin" && (
                  <>
                    <div className="h-px bg-[#F0F2F5]" />
                    <button
                      onClick={() => {
                        setShowConvMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                      <span>Delete Chat</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
       
                       {/* ⭐ NEW: Details Toggle Button ⭐ */}
          <button
            onClick={() => setShowContactPanel((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/10 rounded-xl text-white text-xs font-semibold transition duration-150"
            title={showContactPanel ? "Hide contact details" : "Show contact details"}
          >
            <span>Details</span>
            {showContactPanel ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronLeft size={13} />
            )}
          </button>


        </div>




      </div>

                  {/* ── 24-Hour Window Expired Notice (Top Small Compact Banner) ── */}
      {activeChat &&
        is24hExpired(activeChat) &&
        activeChat.status === "OPEN" &&
        !activeChat.contact?.isBlocked && (
          <div className="flex items-center justify-center py-1.5 bg-[#ECE5DD] shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-[10px] font-medium text-amber-900 shadow-xs">
              <AlertTriangle size={12} className="text-amber-600 shrink-0" />
              <span>
                {activeChat.channel === "MESSENGER" || activeChat.channel === "INSTAGRAM"
                  ? "Standard 24h window has ended. Responses will use 7-day Human Agent window."
                  : "It has been more than 24 hours since customer messaged. You can only respond using a Template."}
              </span>
            </div>
          </div>
        )}

      {/* Collision Warning Alert Banner */}
      {typingAgents.filter((t) => String(t.userId) !== String(user?.id)).length > 0 && (
        <div className="bg-amber-500 text-white px-5 py-2.5 flex items-center justify-between shadow-md animate-pulse shrink-0 border-b border-amber-600">
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertTriangle size={16} className="text-amber-100 shrink-0" />
            <span>
              ⚠️ COLLISION ALERT:{" "}
              {typingAgents
                .filter((t) => String(t.userId) !== String(user?.id))
                .map((t) => t.name)
                .join(", ")}{" "}
              is currently typing a reply to this customer!
            </span>
          </div>
          <span className="text-[9px] bg-black/20 text-white px-2 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
            Live
          </span>
        </div>
      )}

      {/* Delete Conversation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-red-100 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 bg-red-500 flex items-center gap-2.5 rounded-t-3xl">
              <Trash2 size={16} className="text-white" />
              <h2 className="text-base font-bold text-white">
                Delete Conversation
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#111B21] font-medium mb-1">
                Are you sure you want to delete this conversation?
              </p>
              <p className="text-xs text-[#667781] mb-6">
                ⚠️ This will permanently delete all messages and cannot be
                undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingConv}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConversation}
                  disabled={deletingConv}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deletingConv ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

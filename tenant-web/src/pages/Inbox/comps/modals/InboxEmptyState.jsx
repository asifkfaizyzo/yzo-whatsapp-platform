// tenant-web/src/pages/Inbox/comps/InboxEmptyState.jsx (do not remove this comment)

import React from "react";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from "react-icons/fa";

/**
 * Channel-aware empty state shown when no conversation is selected.
 * Displays branding, description, and optional "no chats in this tab" hint.
 * Extracted from inline JSX in original Inbox.jsx.
 */

const CHANNEL_CONFIG = {
  WHATSAPP: {
    title: "WhatsApp Business",
    desc: "Send and receive messages with your customers on WhatsApp. Select a conversation to get started.",
    footer: "End-to-end encrypted \u2022 Meta Cloud API",
    iconBg: "bg-[#25D366] text-white shadow-emerald-500/20",
    renderIcon: () => <FaWhatsapp className="w-10 h-10 text-white" />,
  },
  MESSENGER: {
    title: "Facebook Messenger",
    desc: "Connect with customers and manage incoming inquiries from your Facebook Pages. Select a conversation to get started.",
    footer: "Connected to Meta Messenger Platform",
    iconBg: "bg-[#0084FF] text-white shadow-blue-500/20",
    renderIcon: () => (
      <FaFacebookMessenger className="w-10 h-10 text-white" />
    ),
  },
  INSTAGRAM: {
    title: "Instagram Direct",
    desc: "Respond to Instagram DMs, story mentions, and customer inquiries in real time. Select a conversation to get started.",
    footer: "Connected to Instagram Graph API",
    iconBg:
      "bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] text-white shadow-pink-500/20",
    renderIcon: () => <FaInstagram className="w-10 h-10 text-white" />,
  },
  ALL: {
    title: "Unified Business Inbox",
    desc: "Manage customer conversations across WhatsApp, Instagram, and Facebook Messenger all in one place. Select a conversation to get started.",
    footer: "Unified Omnichannel Messaging Platform",
    iconBg:
      "bg-gradient-to-br from-[#075E54] to-[#128C7E] text-white shadow-teal-500/20",
    renderIcon: () => (
      <div className="flex items-center justify-center gap-2 text-white">
        <FaWhatsapp className="text-xl" />
        <FaInstagram className="text-xl" />
        <FaFacebookMessenger className="text-xl" />
      </div>
    ),
  },
};

export default function InboxEmptyState({
  selectedChannel,
  tabFilteredChatsLength,
  loading,
  onSelectAllChannels,
}) {
  const config = CHANNEL_CONFIG[selectedChannel] || CHANNEL_CONFIG.ALL;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: "#F0F2F5" }}
    >
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100/80 p-8 md:p-10 flex flex-col items-center max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg ${config.iconBg}`}
        >
          {config.renderIcon()}
        </div>
        <h3 className="text-xl font-bold text-[#111B21] mb-1.5">
          {config.title}
        </h3>
        <p className="text-xs md:text-sm text-[#667781] text-center mb-5 leading-relaxed">
          {config.desc}
        </p>

        {tabFilteredChatsLength === 0 && !loading && (
          <div className="mb-4 px-3 py-2 bg-[#F0F2F5] rounded-xl text-xs text-[#54656F] flex items-center gap-2">
            <span>
              No{" "}
              {selectedChannel !== "ALL"
                ? selectedChannel.toLowerCase()
                : ""}{" "}
              chats in this tab
            </span>
            {selectedChannel !== "ALL" && (
              <button
                onClick={onSelectAllChannels}
                className="text-[#075E54] font-bold hover:underline"
              >
                Show All
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8696A0]">
          <svg
            viewBox="0 0 10 10"
            className="w-3 h-3 text-[#075E54]"
            fill="currentColor"
          >
            <path d="M5 0a5 5 0 100 10A5 5 0 005 0zm.5 7.5h-1v-1h1v1zm0-2h-1v-3h1v3z" />
          </svg>
          <span>{config.footer}</span>
        </div>
      </div>
    </div>
  );
}
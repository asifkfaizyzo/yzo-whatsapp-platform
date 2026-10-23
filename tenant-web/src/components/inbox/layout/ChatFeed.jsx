import React from 'react';
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from 'react-icons/fa';
import { RefreshCw, Trash2, ArrowDownLeft, ChevronDown, Paperclip, Eye, ShoppingBag, MapPin, ExternalLink, Copy, CheckCheck, Check } from 'lucide-react';
import CallMessageBubble from '../CallMessageBubble';

export default function ChatFeed({
  chatContainerRef,
  handleScroll,
  loadingMessages,
  timelineItems,
  formatDate,
  activeChat,
  handleInitiateCall,
  formatTime,
  hoveredMessageId,
  setHoveredMessageId,
  canDeleteMessage,
  deleteConfirmId,
  setDeleteConfirmId,
  deletingMessageId,
  handleDeleteMessage,
  user,
  getMediaUrl,
  setPreviewImageModal,
  typingAgents,
  messagesEndRef,
  showScrollArrow,
  scrollToBottom
}) {
  return (
    <>
            {/* Message Thread */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-6 overflow-y-auto space-y-3 relative"
              style={{
                backgroundColor: "#ECE5DD",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23075E54' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-16">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-[#075E54] shadow-sm">
                    <RefreshCw size={13} className="animate-spin text-[#25D366]" />
                    <span>Loading messages...</span>
                  </div>
                </div>
              ) : (
                timelineItems.length > 0 && (
                  <div className="flex items-center justify-center mb-2">
                    <span className="px-4 py-1 bg-white/80 backdrop-blur-sm rounded-lg text-[10px] font-semibold text-[#54656F] shadow-sm">
                      {formatDate(timelineItems[0]?.createdAt)}
                    </span>
                  </div>
                )
              )}

              {timelineItems.map((item, itemIdx) => {
                if (item._itemType === "CALL") {
                  return (
                    <CallMessageBubble
                      key={item.id || item.wacid || `call-${itemIdx}`}
                      call={item}
                      onCallContact={() => handleInitiateCall(activeChat.contact)}
                    />
                  );
                }

                const msg = item;
                const isAgent = !msg.isFromCustomer;
                const timeStr = formatTime(msg.createdAt);

               

                // ── DELETED MESSAGE UI ──
                if (msg.isDeleted) {
                  return (
                    <div
                      key={msg.id || `msg-del-${msgIdx}`}
                      className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm text-[13px] relative opacity-60 ${isAgent
                          ? "bg-[#D9FDD3] text-[#111B21] rounded-tr-none"
                          : "bg-white text-[#111B21] rounded-tl-none"
                          }`}
                      >
                        <p className="italic text-[#667781] text-xs flex items-center gap-1">
                          🚫 This message was deleted
                        </p>
                        <div className="mt-1 flex justify-end">
                          <span className="text-[10px] text-[#667781]">
                            {timeStr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── NORMAL MESSAGE UI ──
                return (
                  <div
                    key={msg.id || `msg-${msgIdx}`}
                    className={`flex ${isAgent ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    {/* Delete Button (left of agent msg) */}
                    {isAgent &&
                      hoveredMessageId === msg.id &&
                      canDeleteMessage(msg) && (
                        <div className="flex items-center mr-1 relative">
                          <button
                            onClick={() =>
                              setDeleteConfirmId(
                                deleteConfirmId === msg.id ? null : msg.id,
                              )
                            }
                            className="p-1.5 rounded-full bg-white/80 hover:bg-red-50 text-[#667781] hover:text-red-500 shadow-sm transition duration-150"
                            title="Delete message"
                          >
                            <Trash2 size={13} />
                          </button>

                          {deleteConfirmId === msg.id && (
                            <div className="absolute bottom-full right-0 mb-1 z-50 bg-white rounded-xl shadow-xl border border-red-100 p-3 w-44">
                              <p className="text-[11px] font-semibold text-[#111B21] mb-2 text-center">
                                Delete this message?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  disabled={deletingMessageId === msg.id}
                                  className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  disabled={deletingMessageId === msg.id}
                                  className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  {deletingMessageId === msg.id ? (
                                    <RefreshCw
                                      size={10}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    "Delete"
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm text-[13px] relative ${isAgent
                        ? "bg-[#D9FDD3] text-[#111B21] rounded-tr-none"
                        : "bg-white text-[#111B21] rounded-tl-none"
                        }`}
                    >
                      {!isAgent && (
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowDownLeft size={10} className="text-[#25D366]" />
                          <span className="text-[9px] font-bold text-[#075E54]">
                            {activeChat.contact?.name?.split(" ")[0]}
                          </span>
                        </div>
                      )}

                      {/* Delete Button for INBOUND (right side, admin only) */}
                      {!isAgent &&
                        hoveredMessageId === msg.id &&
                        canDeleteMessage(msg) && (
                          <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                            <button
                              onClick={() =>
                                setDeleteConfirmId(
                                  deleteConfirmId === msg.id ? null : msg.id,
                                )
                              }
                              className="p-1.5 rounded-full bg-white/80 hover:bg-red-50 text-[#667781] hover:text-red-500 shadow-sm transition duration-150"
                              title="Delete message"
                            >
                              <Trash2 size={13} />
                            </button>

                            {deleteConfirmId === msg.id && (
                              <div className="absolute bottom-full left-0 mb-1 z-50 bg-white rounded-xl shadow-xl border border-red-100 p-3 w-44">
                                <p className="text-[11px] font-semibold text-[#111B21] mb-2 text-center">
                                  Delete this message?
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={deletingMessageId === msg.id}
                                    className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    disabled={deletingMessageId === msg.id}
                                    className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                  >
                                    {deletingMessageId === msg.id ? (
                                      <RefreshCw
                                        size={10}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      "Delete"
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* TEXT / INTERACTIVE BODY */}
                      {(msg.type === "TEXT" || msg.type === "INTERACTIVE_BUTTONS" || (!msg.type && msg.text)) && (
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}



                      {/* IMAGE */}
                      {msg.type === "IMAGE" && msg.mediaUrl && (
                        <div className="mb-1">
                          <div
                            onClick={() =>
                              setPreviewImageModal({
                                type: "IMAGE",
                                url: getMediaUrl(msg.mediaUrl),
                                name: msg.mediaName,
                                caption: msg.caption,
                              })
                            }
                            className="block relative group cursor-pointer"
                            title="Click to preview image"
                          >
                            <img
                              src={getMediaUrl(msg.mediaUrl)}
                              alt={msg.mediaName || "image"}
                              className="rounded-lg max-w-full hover:opacity-90 transition shadow-sm"
                              style={{
                                maxWidth: "220px",
                                maxHeight: "200px",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                          {msg.caption && (
                            <p className="text-xs mt-1 text-[#111B21]">
                              {msg.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {/* FILE */}
                      {msg.type === "FILE" && msg.mediaUrl && (
                        <div
                          onClick={() =>
                            setPreviewImageModal({
                              type: "FILE",
                              url: getMediaUrl(msg.mediaUrl),
                              name: msg.mediaName,
                              caption: msg.caption,
                            })
                          }
                          className="flex items-center gap-2 p-2 bg-white/60 hover:bg-white/90 rounded-lg mb-1 min-w-[180px] transition cursor-pointer group shadow-sm"
                          title="Click to preview/view file"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#075E54]/10 flex items-center justify-center shrink-0">
                            <Paperclip size={16} className="text-[#075E54]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#111B21] truncate group-hover:text-[#075E54] transition">
                              {msg.mediaName || "File"}
                            </p>
                            <p className="text-[9px] text-[#667781]">
                              {msg.mediaSize
                                ? msg.mediaSize < 1024 * 1024
                                  ? (msg.mediaSize / 1024).toFixed(1) + " KB"
                                  : (msg.mediaSize / (1024 * 1024)).toFixed(1) +
                                  " MB"
                                : ""}
                            </p>
                            {msg.caption && (
                              <p className="text-[10px] text-[#111B21] mt-0.5">
                                {msg.caption}
                              </p>
                            )}
                          </div>
                          <div className="text-[#075E54] hover:text-[#064E47] transition shrink-0 p-1">
                            <Eye size={16} />
                          </div>
                        </div>
                      )}

                      {/* VIDEO */}
                      {msg.type === "VIDEO" && msg.mediaUrl && (
                        <div className="mb-1">
                          <div
                            onClick={() =>
                              setPreviewImageModal({
                                type: "VIDEO",
                                url: getMediaUrl(msg.mediaUrl),
                                name: msg.mediaName,
                                caption: msg.caption,
                              })
                            }
                            className="relative group cursor-pointer"
                            title="Click for full-screen video player"
                          >
                            <video
                              src={getMediaUrl(msg.mediaUrl)}
                              controls
                              className="rounded-lg"
                              style={{ maxWidth: "220px" }}
                            />
                          </div>
                          {msg.caption && (
                            <p className="text-xs mt-1 text-[#111B21]">
                              {msg.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {/* AUDIO */}
                      {msg.type === "AUDIO" && msg.mediaUrl && (
                        <div className="mb-1">
                          <audio
                            src={getMediaUrl(msg.mediaUrl)}
                            controls
                            style={{ maxWidth: "220px" }}
                          />
                        </div>
                      )}

                      {/* ORDER (WhatsApp Cart / Commerce) */}
                      {msg.type === "ORDER" && (
                        <div className="mb-1">
                          <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 rounded-xl p-3 min-w-[240px] max-w-[280px] shadow-xs">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/60">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                  <ShoppingBag size={13} />
                                </div>
                                <span className="text-xs font-bold text-emerald-900">
                                  WhatsApp Order
                                </span>
                              </div>
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-200/60 text-emerald-800 tracking-wider">
                                Received
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* CATALOG (WhatsApp Catalog Message) */}
                      {msg.type === "CATALOG" && (
                        <div className="mb-1">
                          <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/70 border border-indigo-200/80 rounded-xl p-3 min-w-[220px] max-w-[260px] shadow-xs">
                            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-indigo-200/60">
                              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <ShoppingBag size={13} />
                              </div>
                              <span className="text-xs font-bold text-indigo-900">
                                Product Catalog
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 leading-relaxed mb-2.5">
                              {msg.text || "Browse our product catalog"}
                            </p>

                            <div className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-bold text-center flex items-center justify-center gap-1.5 shadow-xs">
                              <ShoppingBag size={12} />
                              <span>View Catalog</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* LOCATION */}
                      {msg.type === "LOCATION" && (() => {
                        let lat = msg.locLatitude ? Number(msg.locLatitude) : null;
                        let lng = msg.locLongitude ? Number(msg.locLongitude) : null;

                        if ((!lat || !lng) && msg.text) {
                          const match = msg.text.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
                          if (match) {
                            lat = Number(match[1]);
                            lng = Number(match[2]);
                          }
                        }

                        return (
                          <div className="my-1.5 w-full min-w-[260px] max-w-[320px] rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md">
                            {/* Map Preview Header */}
                            <div className="relative h-28 bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-200/70">
                              {/* Stylized Google Maps Background Grid */}
                              <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/10" />

                              {/* Stylized Road Lines Simulation */}
                              <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                                <path d="M-20,40 Q80,10 160,50 T340,70" fill="none" stroke="#64748b" strokeWidth="6" />
                                <path d="M40,-10 Q90,60 180,90 T300,140" fill="none" stroke="#cbd5e1" strokeWidth="4" />
                                <path d="M120,-10 L140,120" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 4" />
                              </svg>

                              {/* Center Static Map Pin */}
                              <div className="relative z-10 flex flex-col items-center drop-shadow-md">
                                <div className="w-9 h-9 rounded-full bg-[#EA4335] text-white flex items-center justify-center border-2 border-white shadow-sm">
                                  <MapPin size={18} className="fill-white" />
                                </div>
                                <div className="w-2 h-1 rounded-full bg-slate-900/40 mt-0.5" />
                              </div>

                              {/* Top Badges */}
                              <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between z-10">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/75 backdrop-blur-md text-[10px] font-bold text-white shadow-sm">
                                  <MapPin size={10} className="text-emerald-400" />
                                  {msg.senderType === "CONTACT" ? "Customer Location" : "Store Location"}
                                </span>
                                {lat && lng && (
                                  <span className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[9px] font-mono font-bold text-slate-700 shadow-sm">
                                    {lat.toFixed(3)}, {lng.toFixed(3)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Location Details Body */}
                            <div className="p-3 bg-white space-y-2.5">
                              <div>
                                <p className="text-xs font-bold text-slate-900 leading-tight">
                                  {msg.locName || (msg.senderType === "CONTACT" ? "📍 Shared Delivery Location" : "🏬 Store Location Pin")}
                                </p>
                                {msg.locAddress && (
                                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                                    {msg.locAddress}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons */}
                              {lat && lng && (
                                <div className="pt-1 flex items-center gap-2">
                                  <a
                                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition active:scale-[0.98]"
                                  >
                                    <ExternalLink size={13} />
                                    <span>Open in Google Maps</span>
                                  </a>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard?.writeText(`${lat}, ${lng}`);
                                    }}
                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                                    title="Copy Coordinates"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {/* ⭐ BUTTONS (Interactive / Template buttons) */}
                      {(() => {
                        let btns = null;
                        if (Array.isArray(msg.buttons)) {
                          btns = msg.buttons;
                        } else if (typeof msg.buttons === "string") {
                          try {
                            btns = JSON.parse(msg.buttons);
                          } catch (e) {
                            btns = null;
                          }
                        }
                        if (!btns || !Array.isArray(btns) || btns.length === 0) return null;

                        return (
                          <div className="mt-2.5 pt-2 border-t border-[#075E54]/10 space-y-1.5">
                            {btns.map((btn, i) => {
                              const title = btn.title || btn.text || `Button ${i + 1}`;
                              const type = (btn.type || "").toUpperCase();
                              const url = btn.url || btn.url_link;
                              const phone = btn.phoneNumber || btn.phone_number;

                              if (type === "URL" && url) {
                                return (
                                  <a
                                    key={btn.id || i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/70 hover:bg-white border border-[#075E54]/20 rounded-lg text-[12px] font-semibold text-[#075E54] hover:text-[#064E47] transition shadow-xs"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                      <polyline points="15 3 21 3 21 9" />
                                      <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                    <span>{title}</span>
                                  </a>
                                );
                              }

                              if (type === "PHONE_NUMBER" && phone) {
                                return (
                                  <a
                                    key={btn.id || i}
                                    href={`tel:${phone}`}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/70 hover:bg-white border border-[#075E54]/20 rounded-lg text-[12px] font-semibold text-[#075E54] hover:text-[#064E47] transition shadow-xs"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    <span>{title}</span>
                                  </a>
                                );
                              }

                              return (
                                <div
                                  key={btn.id || i}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/70 hover:bg-white border border-[#075E54]/20 rounded-lg text-[12px] font-semibold text-[#075E54] transition cursor-default shadow-xs"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 11.24V7.5a2.5 2.5 0 015 0v3.74" />
                                    <path d="M14 11h1a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6a2 2 0 012-2h1" />
                                  </svg>
                                  <span>{title}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Time + Ticks */}
                      <div className="mt-1 flex items-center gap-1 justify-end text-[10px] text-[#667781]">
                        {!isAgent && (
                          <span className="inline-flex items-center mr-0.5">
                            {(activeChat.channel === "WHATSAPP" || !activeChat.channel) && (
                              <FaWhatsapp className="text-[#25D366] text-[11px]" title="via WhatsApp" />
                            )}
                            {activeChat.channel === "MESSENGER" && (
                              <FaFacebookMessenger className="text-[#0084FF] text-[11px]" title="via Messenger" />
                            )}
                            {activeChat.channel === "INSTAGRAM" && (
                              <FaInstagram className="text-[#E1306C] text-[11px]" title="via Instagram" />
                            )}
                          </span>
                        )}
                        <span>{timeStr}</span>
                        {isAgent && (
                          <>
                            {msg.status === "sent" && (
                              <Check size={14} className="text-[#667781]" />
                            )}
                            {msg.status === "delivered" && (
                              <CheckCheck
                                size={14}
                                className="text-[#667781]"
                              />
                            )}
                            {(msg.status === "read" || msg.isRead) && (
                              <CheckCheck
                                size={14}
                                className="text-[#53BDEB]"
                              />
                            )}
                            {!msg.status && !msg.isRead && (
                              <CheckCheck
                                size={14}
                                className="text-[#667781]"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!loadingMessages && timelineItems.length === 0 && (
                <div className="flex flex-col items-center justify-center my-12">
                  <div className="w-20 h-20 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center mb-3 shadow-sm">
                    <FaWhatsapp className="w-10 h-10 text-[#25D366]/40" />
                  </div>
                  <p className="text-xs text-[#54656F] font-medium bg-white/60 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              )}
            
                        {/* Live Typing Indicator Pill */}
              {typingAgents.filter((t) => String(t.userId) !== String(user?.id)).length > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full w-fit shadow-md border border-emerald-200/60 mb-2 transition-all">
                  <span className="text-xs text-[#075E54] font-bold">
                    {typingAgents
                      .filter((t) => String(t.userId) !== String(user?.id))
                      .map((t) => t.name)
                      .join(", ")}{" "}
                    {typingAgents.filter((t) => String(t.userId) !== String(user?.id)).length === 1 ? "is" : "are"}{" "}
                    typing
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce" />
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Floating WhatsApp-Style Scroll To Bottom Button ── */}
            {showScrollArrow && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-20 right-6 z-30 p-2.5 bg-white hover:bg-[#F0F2F5] text-[#54656F] hover:text-[#075E54] rounded-full shadow-md border border-[#E9EDEF] transition duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center justify-center animate-in fade-in zoom-in-95"
                title="Scroll to bottom"
              >
                <ChevronDown size={18} className="stroke-[2.5]" />
              </button>
            )}

    </>
  );
}
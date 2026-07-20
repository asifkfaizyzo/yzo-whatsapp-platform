import React, { useState, useEffect } from "react";
import {
  TicketCheck,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Send,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
} from "lucide-react";
import api from "../../lib/axios";

// ── Helpers ──
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ── Status Badge ──
const StatusBadge = ({ status }) => {
  const map = {
    OPEN: {
      label: "Open",
      className: "bg-blue-50 text-blue-700 border border-blue-100",
      icon: <Clock size={11} />,
    },
    IN_PROGRESS: {
      label: "In Progress",
      className: "bg-amber-50 text-amber-700 border border-amber-100",
      icon: <RefreshCw size={11} />,
    },
    RESOLVED: {
      label: "Resolved",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
      icon: <CheckCircle2 size={11} />,
    },
    CLOSED: {
      label: "Closed",
      className: "bg-slate-100 text-slate-500 border border-slate-200",
      icon: <XCircle size={11} />,
    },
  };
  const config = map[status] || map.OPEN;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full 
                  text-[11px] font-semibold ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

// ── Priority Badge ──
const PriorityBadge = ({ priority }) => {
  const map = {
    LOW: "bg-slate-50 text-slate-500 border border-slate-200",
    MEDIUM: "bg-yellow-50 text-yellow-700 border border-yellow-100",
    HIGH: "bg-orange-50 text-orange-700 border border-orange-100",
    URGENT: "bg-red-50 text-red-700 border border-red-100",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full 
                  text-[11px] font-semibold ${map[priority] || map.LOW}`}
    >
      {priority}
    </span>
  );
};

// ── Sender Label ──
const SenderLabel = ({ sentBy, ticket }) => {
  if (sentBy === "SUPER_ADMIN") return "Support Team";
  if (sentBy === "TENANT") return ticket?.tenant?.tenantName || "Tenant";
  if (sentBy === "USER") return ticket?.user?.name || "User";
  return sentBy;
};

// ══════════════════════════════════════════
// TICKET DETAIL VIEW
// ══════════════════════════════════════════
const TicketDetail = ({ ticketId, onBack }) => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      if (res.data.success) {
        setTicket(res.data.data);
        setStatus(res.data.data.status);
        setPriority(res.data.data.priority);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${ticketId}/reply`, {
        message: reply,
        isInternal,
      });
      setReply("");
      setIsInternal(false);
      await fetchTicket();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      setStatus(newStatus);
      await fetchTicket();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    try {
      await api.patch(`/tickets/${ticketId}/priority`, {
        priority: newPriority,
      });
      setPriority(newPriority);
    } catch (e) {
      console.error(e);
    }
  };

  // ✅ Helper — ticket is locked if RESOLVED or CLOSED
  const isLocked = status === "RESOLVED" || status === "CLOSED";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold
                   text-[#125EF2] hover:text-[#0d4fd6] transition"
      >
        <ArrowLeft size={16} />
        Back to Tickets
      </button>

      {/* Ticket Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div
          className="flex flex-col sm:flex-row sm:items-start
                        justify-between gap-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-bold text-slate-400
                               uppercase tracking-wider"
              >
                {ticket.ticketNumber}
              </span>
              {ticket.isEscalated && (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5
                                 bg-red-50 text-red-600 border border-red-100
                                 rounded-full"
                >
                  ⚠️ Escalated
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{ticket.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{ticket.description}</p>

            {/* ── Attachment Viewer — all file types ── */}
            {ticket.attachmentUrl &&
              (() => {
                const url = `${import.meta.env.VITE_API_URL}${ticket.attachmentUrl}`;
                const ext = ticket.attachmentUrl.split(".").pop().toLowerCase();

                const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
                const isPdf = ext === "pdf";
                const isVideo = ext === "mp4";
                const isAudio = ["mp3", "mpeg"].includes(ext);
                const isText = ext === "txt";

                return (
                  <div className="mt-4">
                    <p
                      className="text-xs font-bold text-slate-400 uppercase
                    tracking-wider mb-2"
                    >
                      Attachment
                    </p>

                    {/* ── Image ── */}
                    {isImage && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-xl overflow-hidden border
                     border-slate-200 hover:border-[#125EF2] transition
                     shadow-sm max-w-sm group"
                      >
                        <img
                          src={url}
                          alt="Ticket attachment"
                          className="w-full max-h-48 object-contain bg-slate-50"
                        />
                        <div
                          className="px-3 py-1.5 bg-white border-t border-slate-100
                          flex items-center gap-1.5"
                        >
                          <CheckCircle2
                            size={11}
                            className="text-emerald-500 shrink-0"
                          />
                          <span
                            className="text-[11px] text-slate-500 font-medium
                             group-hover:text-[#125EF2] transition"
                          >
                            Click to open full image
                          </span>
                        </div>
                      </a>
                    )}

                    {/* ── PDF ── */}
                    {isPdf && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-4 py-3 rounded-xl
                     bg-red-50 border border-red-100 hover:border-red-300
                     transition max-w-sm group"
                      >
                        <div
                          className="p-2 bg-white rounded-lg border border-red-100
                          shadow-sm shrink-0"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5 text-red-500"
                          >
                            <path
                              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12
                       a2 2 0 0 0 2-2V8z"
                            />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="9" y1="13" x2="15" y2="13" />
                            <line x1="9" y1="17" x2="15" y2="17" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-red-700 truncate">
                            {ticket.attachmentUrl.split("/").pop()}
                          </p>
                          <p className="text-[11px] text-red-400 mt-0.5">
                            Click to open PDF
                          </p>
                        </div>
                      </a>
                    )}

                    {/* ── Video ── */}
                    {isVideo && (
                      <div
                        className="rounded-xl overflow-hidden border border-slate-200
                        shadow-sm max-w-sm bg-black"
                      >
                        <video controls className="w-full max-h-48" src={url}>
                          Your browser does not support video playback.
                        </video>
                        <div
                          className="px-3 py-1.5 bg-white border-t border-slate-100
                          flex items-center gap-1.5"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3 h-3 text-purple-500 shrink-0"
                          >
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect
                              x="1"
                              y="5"
                              width="15"
                              height="14"
                              rx="2"
                              ry="2"
                            />
                          </svg>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Video attachment
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ── Audio ── */}
                    {isAudio && (
                      <div
                        className="rounded-xl overflow-hidden border border-amber-100
                        bg-amber-50 shadow-sm max-w-sm"
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div
                            className="p-2 bg-white rounded-lg border border-amber-100
                            shadow-sm shrink-0"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-5 h-5 text-amber-500"
                            >
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                          <p className="text-xs font-bold text-amber-700 truncate flex-1">
                            {ticket.attachmentUrl.split("/").pop()}
                          </p>
                        </div>
                        <audio controls className="w-full px-3 pb-3">
                          <source src={url} type="audio/mpeg" />
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )}

                    {/* ── Text File ── */}
                    {isText && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-4 py-3 rounded-xl
                     bg-slate-50 border border-slate-200
                     hover:border-slate-300 transition max-w-sm group"
                      >
                        <div
                          className="p-2 bg-white rounded-lg border border-slate-200
                          shadow-sm shrink-0"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5 text-slate-500"
                          >
                            <path
                              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12
                       a2 2 0 0 0 2-2V8z"
                            />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="8" y1="13" x2="16" y2="13" />
                            <line x1="8" y1="17" x2="16" y2="17" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {ticket.attachmentUrl.split("/").pop()}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Click to open text file
                          </p>
                        </div>
                      </a>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Status & Priority Controls */}
          <div className="flex flex-col gap-2 min-w-[160px]">
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-1">
                Status
              </p>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 bg-white font-semibold"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-1">
                Priority
              </p>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 bg-white font-semibold"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Tenant</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {ticket.tenant?.tenantName || "—"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Category</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
              {ticket.category}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Raised By</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
              {ticket.raisedBy === "USER"
                ? ticket.user?.name || "User"
                : ticket.tenant?.tenantName || "Tenant"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Created</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {formatDate(ticket.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation Thread */}
      <div
        className="bg-white rounded-2xl border border-slate-100
                      shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Conversation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {ticket.messages?.length || 0} message
            {ticket.messages?.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Messages */}
        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
          {ticket.messages?.length === 0 ? (
            <div className="text-center py-8">
              <TicketCheck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No messages yet</p>
            </div>
          ) : (
            ticket.messages?.map((msg) => {
              const isAdmin = msg.sentBy === "SUPER_ADMIN";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] flex flex-col gap-1 ${
                      isAdmin ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Internal Note Badge */}
                    {msg.isInternal && (
                      <span
                        className="flex items-center gap-1 text-[10px]
                                       font-bold text-amber-600 bg-amber-50
                                       px-2 py-0.5 rounded-full border
                                       border-amber-100 self-end"
                      >
                        <Lock size={9} />
                        Internal Note
                      </span>
                    )}

                    <div
                      className={`px-4 py-3 rounded-2xl text-sm ${
                        isAdmin
                          ? msg.isInternal
                            ? "bg-amber-50 border border-amber-100 text-amber-900"
                            : "bg-[#125EF2] text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p
                        className={`text-[10px] font-bold mb-1 ${
                          isAdmin
                            ? msg.isInternal
                              ? "text-amber-600"
                              : "text-blue-100"
                            : "text-slate-400"
                        }`}
                      >
                        <SenderLabel sentBy={msg.sentBy} ticket={ticket} />
                      </p>
                      <p className="leading-relaxed">{msg.message}</p>
                    </div>

                    <p className="text-[10px] text-slate-400 px-1">
                      {formatDate(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ✅ FIXED — Reply Box locked on BOTH RESOLVED and CLOSED */}
        {!isLocked ? (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            {/* Internal Note Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setIsInternal(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                            text-xs font-semibold transition ${
                              !isInternal
                                ? "bg-[#125EF2] text-white"
                                : "bg-white border border-slate-200 text-slate-500"
                            }`}
              >
                <Send size={11} />
                Reply to Tenant
              </button>
              <button
                onClick={() => setIsInternal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                            text-xs font-semibold transition ${
                              isInternal
                                ? "bg-amber-500 text-white"
                                : "bg-white border border-slate-200 text-slate-500"
                            }`}
              >
                <Lock size={11} />
                Internal Note
              </button>
            </div>

            <div className="flex gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  isInternal
                    ? "Write an internal note (only visible to admins)..."
                    : "Write a reply to the tenant..."
                }
                rows={3}
                className="flex-1 px-4 py-3 text-sm border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 resize-none bg-white"
              />
              <button
                onClick={handleReply}
                disabled={sending || !reply.trim()}
                className={`self-end flex items-center gap-2 px-4 py-3
                            rounded-xl text-sm font-bold transition ${
                              sending || !reply.trim()
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : isInternal
                                  ? "bg-amber-500 text-white hover:bg-amber-600"
                                  : "bg-[#125EF2] text-white hover:bg-[#0d4fd6]"
                            }`}
              >
                {sending ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        ) : (
          // ✅ FIXED — Shows for both RESOLVED and CLOSED
          <div
            className="px-6 py-4 border-t border-slate-100
                          bg-slate-50 text-center"
          >
            <p className="text-xs font-semibold text-slate-400">
              This ticket is {status.toLowerCase()}. No further replies allowed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// MAIN TICKETS PAGE
// ══════════════════════════════════════════
export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  // ── Filters ──
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterEscalated, setFilterEscalated] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus !== "ALL") params.status = filterStatus;
      if (filterPriority !== "ALL") params.priority = filterPriority;
      if (filterEscalated === "true") params.escalated = "true";

      const res = await api.get("/tickets", { params });
      if (res.data.success) setTickets(res.data.data);
    } catch (e) {
      setError("Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterPriority, filterEscalated]);

  // ── Search Filter ──
  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.ticketNumber?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q) ||
      t.tenant?.tenantName?.toLowerCase().includes(q)
    );
  });

  // ── Stats ──
  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;
  const escalatedCount = tickets.filter((t) => t.isEscalated).length;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 bg-slate-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <p className="text-sm font-semibold text-slate-600">{error}</p>
        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 px-4 py-2 bg-[#125EF2] text-white
                     text-sm font-semibold rounded-xl hover:bg-[#0d4fd6] transition"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (selectedTicketId) {
    return (
      <TicketDetail
        ticketId={selectedTicketId}
        onBack={() => {
          setSelectedTicketId(null);
          fetchTickets();
        }}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Support Tickets
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Manage and respond to tenant and user support requests
          </p>
        </div>
        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold
                     text-slate-500 hover:text-slate-700 hover:bg-slate-100
                     rounded-xl transition border border-slate-200"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className="card p-5 border border-slate-100 bg-white
                        flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold text-slate-400
                             uppercase tracking-wider"
            >
              Open
            </span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
              <Clock size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">
              {openCount}
            </span>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Awaiting response
            </p>
          </div>
        </div>

        <div
          className="card p-5 border border-slate-100 bg-white
                        flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold text-slate-400
                             uppercase tracking-wider"
            >
              In Progress
            </span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
              <RefreshCw size={16} className="text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">
              {inProgressCount}
            </span>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Being handled
            </p>
          </div>
        </div>

        <div
          className="card p-5 border border-slate-100 bg-white
                        flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold text-slate-400
                             uppercase tracking-wider"
            >
              Resolved
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">
              {resolvedCount}
            </span>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Issues fixed
            </p>
          </div>
        </div>

        <div
          className="card p-5 border border-slate-100 bg-white
                        flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold text-slate-400
                             uppercase tracking-wider"
            >
              Escalated
            </span>
            <div className="p-2 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle size={16} className="text-red-500" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">
              {escalatedCount}
            </span>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Needs attention
            </p>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card border border-slate-100 bg-white overflow-hidden">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div
            className="flex flex-col sm:flex-row sm:items-center
                          justify-between gap-4"
          >
            <div>
              <h2 className="text-base font-bold text-slate-800">
                All Tickets
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredTickets.length} of {tickets.length} tickets
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2
                             text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200
                             rounded-xl focus:outline-none focus:ring-2
                             focus:ring-[#125EF2]/20 w-40"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20"
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20"
              >
                <option value="ALL">All Priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>

              {/* Escalated Filter */}
              <select
                value={filterEscalated}
                onChange={(e) => setFilterEscalated(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20"
              >
                <option value="ALL">All Tickets</option>
                <option value="true">Escalated Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {filteredTickets.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center
                          py-16 gap-3"
          >
            <TicketCheck size={32} className="text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">
              No tickets found
            </p>
            <p className="text-xs text-slate-400">
              Tickets will appear here when tenants or users raise them
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="bg-slate-50 text-xs text-slate-400 font-bold
                               uppercase tracking-wider border-b border-slate-100"
                >
                  <th className="px-5 py-3.5">Ticket</th>
                  <th className="px-5 py-3.5">Tenant</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Priority</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Raised By</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-slate-50/60 transition"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {ticket.isEscalated && (
                          <span className="text-red-500" title="Escalated">
                            ⚠️
                          </span>
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#125EF2]">
                            {ticket.ticketNumber}
                          </p>
                          <p
                            className="text-sm font-semibold text-slate-800
                                        mt-0.5 max-w-[200px] truncate"
                          >
                            {ticket.title}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-700">
                        {ticket.tenant?.tenantName || "—"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {ticket.tenant?.email || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className="text-xs font-semibold text-slate-600
                                       bg-slate-100 px-2 py-0.5 rounded-full
                                       capitalize"
                      >
                        {ticket.category}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <PriorityBadge priority={ticket.priority} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={ticket.status} />
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5
                                    rounded-full border ${
                                      ticket.raisedBy === "TENANT"
                                        ? "bg-blue-50 text-blue-700 border-blue-100"
                                        : "bg-purple-50 text-purple-700 border-purple-100"
                                    }`}
                      >
                        {ticket.raisedBy}
                      </span>
                    </td>

                    <td
                      className="px-5 py-4 text-xs text-slate-500
                                   font-medium whitespace-nowrap"
                    >
                      {formatDate(ticket.createdAt)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className="px-3 py-1.5 text-xs font-bold
                                   text-[#125EF2] bg-[#EAF2FE]
                                   hover:bg-[#CFE0FD] rounded-lg transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

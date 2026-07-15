// tenant-web/src/pages/dashboard/Tickets.jsx
// ✅ Full updated file below

import React, { useState, useEffect } from "react";
import {
  TicketCheck,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  ChevronRight,
  Users,
  User,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
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

// ── Get userType from localStorage ──
const getUserType = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.type === "TENANT" ? "TENANT" : "USER";
  } catch {
    return "TENANT";
  }
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
      className={`inline-flex items-center gap-1 px-2 py-0.5
                  rounded-full text-[11px] font-semibold ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

// ── Priority Badge ──
const PriorityBadge = ({ priority }) => {
  const map = {
    LOW:    "bg-slate-50 text-slate-500 border border-slate-200",
    MEDIUM: "bg-yellow-50 text-yellow-700 border border-yellow-100",
    HIGH:   "bg-orange-50 text-orange-700 border border-orange-100",
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


// ══════════════════════════════════════════
// NEW TICKET FORM
// ══════════════════════════════════════════
const NewTicketForm = ({ onClose, onSuccess, type = "TENANT" }) => {
  const [form, setForm]       = useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "LOW",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const endpoint = type === "TENANT" ? "/tickets" : "/user-tickets";
      await api.post(endpoint, form);
      onSuccess();
    } catch (e) {
      setError("Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg
                      border border-slate-100 animate-in fade-in duration-200">

        <div className="px-6 py-4 border-b border-slate-100 flex items-center
                        justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Raise New Ticket
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {type === "TENANT"
                ? "Your ticket will be sent to SuperAdmin support"
                : "Your ticket will be sent to your Tenant admin"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition
                       text-slate-400"
          >
            <XCircle size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border
                            border-red-100 rounded-xl text-xs text-red-600
                            font-semibold">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              Title *
            </label>
            <input
              type="text"
              placeholder="Brief summary of your issue..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-slate-200
                         rounded-xl focus:outline-none focus:ring-2
                         focus:ring-[#125EF2]/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              Description *
            </label>
            <textarea
              placeholder="Describe your issue in detail..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              className="w-full px-4 py-2.5 text-sm border border-slate-200
                         rounded-xl focus:outline-none focus:ring-2
                         focus:ring-[#125EF2]/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className="w-full px-3 py-2.5 text-sm border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 bg-white"
              >
                <option value="GENERAL">General</option>
                <option value="BILLING">Billing</option>
                <option value="TECHNICAL">Technical</option>
                <option value="FEATURE">Feature Request</option>
                <option value="ACCOUNT">Account</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
                className="w-full px-3 py-2.5 text-sm border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex
                        items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500
                       hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-bold
                        rounded-xl transition ${
              submitting
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-[#125EF2] text-white hover:bg-[#0d4fd6] shadow-sm"
            }`}
          >
            {submitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={14} />
                Submit Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


// ══════════════════════════════════════════
// TICKET DETAIL
// ══════════════════════════════════════════
const TicketDetail = ({ ticket, onBack, onRefresh, userType }) => {
  const [reply, setReply]           = useState("");
  const [sending, setSending]       = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [resolving, setResolving]   = useState(false);

  const isUserTicket = ticket.raisedBy === "USER";

  // ✅ FIXED — locks on BOTH RESOLVED and CLOSED
  const isLocked =
    ticket.status === "CLOSED" || ticket.status === "RESOLVED";

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      let endpoint;

      if (userType === "TENANT") {
        if (isUserTicket) {
          endpoint = `/tickets/${ticket.id}/reply-user`; // tenant → user
        } else {
          endpoint = `/tickets/${ticket.id}/reply`;       // tenant → superadmin
        }
      } else {
        // USER replying to tenant
        endpoint = `/user-tickets/${ticket.id}/reply`;
      }

      await api.post(endpoint, { message: reply });
      setReply("");
      await onRefresh(ticket.id);
    } catch (e) {
      console.error("Reply error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      await api.patch(`/tickets/${ticket.id}/escalate`);
      await onRefresh(ticket.id);
    } catch (e) {
      console.error(e);
    } finally {
      setEscalating(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await api.patch(`/tickets/${ticket.id}/resolve`);
      onBack();
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(false);
    }
  };

  const handleClose = async () => {
    try {
      await api.patch(`/tickets/${ticket.id}/close`);
      onBack();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold
                   text-[#125EF2] hover:text-[#0d4fd6] transition"
      >
        <ArrowLeft size={16} />
        Back to Tickets
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start
                        justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-bold text-slate-400
                               uppercase tracking-wider">
                {ticket.ticketNumber}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.isEscalated && (
                <span className="text-[11px] font-semibold px-2 py-0.5
                                 bg-red-50 text-red-600 border border-red-100
                                 rounded-full">
                  ⚠️ Escalated to SuperAdmin
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              {ticket.title}
            </h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {/* Action Buttons — TENANT ONLY and only when NOT locked */}
          {!isLocked && userType === "TENANT" && (
            <div className="flex flex-wrap gap-2 shrink-0">

              {/* Escalate — only for user tickets not yet escalated */}
              {isUserTicket && !ticket.isEscalated && (
                <button
                  onClick={handleEscalate}
                  disabled={escalating}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs
                             font-bold text-orange-700 bg-orange-50
                             border border-orange-100 rounded-xl
                             hover:bg-orange-100 transition disabled:opacity-50"
                >
                  {escalating ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  Escalate to Admin
                </button>
              )}

              {/* Resolve — only for user tickets */}
              {isUserTicket && (
                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs
                             font-bold text-emerald-700 bg-emerald-50
                             border border-emerald-100 rounded-xl
                             hover:bg-emerald-100 transition disabled:opacity-50"
                >
                  {resolving ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  Mark Resolved
                </button>
              )}

              {/* Close — only for tenant's own tickets */}
              {!isUserTicket && (
                <button
                  onClick={handleClose}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs
                             font-bold text-slate-500 bg-slate-100
                             border border-slate-200 rounded-xl
                             hover:bg-slate-200 transition"
                >
                  <XCircle size={12} />
                  Close Ticket
                </button>
              )}
            </div>
          )}
        </div>

        {/* Meta Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Category</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
              {ticket.category}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Raised By</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {ticket.raisedBy === "USER"
                ? ticket.user?.name || "User"
                : userType === "TENANT"
                  ? "You (Tenant)"
                  : "You"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Created</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {formatDate(ticket.createdAt)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Updated</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {formatDate(ticket.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-white rounded-2xl border border-slate-100
                      shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">
            Conversation
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {ticket.messages?.filter((m) => !m.isInternal).length || 0} messages
          </p>
        </div>

        {/* Messages */}
        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
          {ticket.messages?.filter((m) => !m.isInternal).length === 0 ? (
            <div className="text-center py-8">
              <TicketCheck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No messages yet</p>
              <p className="text-xs text-slate-300 mt-1">
                Start the conversation below
              </p>
            </div>
          ) : (
            ticket.messages
              ?.filter((msg) => !msg.isInternal)
              .map((msg) => {
                const isMine =
                  userType === "TENANT"
                    ? msg.sentBy === "TENANT"
                    : msg.sentBy === "USER";

                const senderLabel = isMine
                  ? "You"
                  : msg.sentBy === "SUPER_ADMIN"
                    ? "Support Team"
                    : msg.sentBy === "TENANT"
                      ? ticket.tenant?.tenantName || "Tenant"
                      : ticket.user?.name || "User";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] flex flex-col gap-1 ${
                        isMine ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm ${
                          isMine
                            ? "bg-[#125EF2] text-white"
                            : msg.sentBy === "SUPER_ADMIN"
                              ? "bg-[#EAF2FE] text-[#125EF2] border border-[#CFE0FD]"
                              : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold mb-1 ${
                            isMine
                              ? "text-blue-100"
                              : msg.sentBy === "SUPER_ADMIN"
                                ? "text-[#125EF2]"
                                : "text-slate-400"
                          }`}
                        >
                          {senderLabel}
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
            <div className="flex gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  userType === "TENANT"
                    ? isUserTicket
                      ? "Reply to user..."
                      : "Reply to Support Team..."
                    : "Reply to Tenant admin..."
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
                    : "bg-[#125EF2] text-white hover:bg-[#0d4fd6] shadow-sm"
                }`}
              >
                {sending ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        ) : (
          // ✅ FIXED — Shows for BOTH RESOLVED and CLOSED
          <div className="px-6 py-4 border-t border-slate-100
                          bg-slate-50 text-center">
            <p className="text-xs font-semibold text-slate-400">
              This ticket is {ticket.status.toLowerCase()}.
              No further replies allowed.
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
  const { tenantStatus } = useOutletContext();
  const userType = getUserType();

  const [activeTab, setActiveTab]           = useState("my");
  const [myTickets, setMyTickets]           = useState([]);
  const [userTickets, setUserTickets]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showNewForm, setShowNewForm]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [filterStatus, setFilterStatus]     = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (userType === "TENANT") {
        const [myRes, userRes] = await Promise.all([
          api.get("/tickets/my"),
          api.get("/tickets/user-tickets/all"),
        ]);
        if (myRes.data.success)   setMyTickets(myRes.data.data);
        if (userRes.data.success) setUserTickets(userRes.data.data);
      } else {
        const res = await api.get("/user-tickets/my");
        if (res.data.success) setMyTickets(res.data.data);
      }
    } catch (e) {
      setError("Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetail = async (ticketId) => {
    try {
      const endpoint =
        userType === "USER"
          ? `/user-tickets/${ticketId}`
          : `/tickets/${ticketId}`;

      const res = await api.get(endpoint);
      if (res.data.success) setSelectedTicket(res.data.data);
    } catch (e) {
      console.error("fetchTicketDetail error:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentList = activeTab === "my" ? myTickets : userTickets;

  const filteredList = currentList.filter((t) => {
    const matchStatus =
      filterStatus === "ALL" || t.status === filterStatus;
    const matchSearch =
      !searchQuery ||
      t.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const openCount        = myTickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount  = myTickets.filter((t) => t.status === "IN_PROGRESS").length;
  const userTicketsCount = userTickets.length;
  const userOpenCount    = userTickets.filter((t) => t.status === "OPEN").length;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
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
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[#125EF2] text-white
                     text-sm font-semibold rounded-xl hover:bg-[#0d4fd6] transition"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        userType={userType}
        onBack={() => {
          setSelectedTicket(null);
          fetchData();
        }}
        onRefresh={fetchTicketDetail}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {showNewForm && (
        <NewTicketForm
          type={userType}
          onClose={() => setShowNewForm(false)}
          onSuccess={() => {
            setShowNewForm(false);
            fetchData();
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center
                      md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Support Tickets
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 font-medium">
            {userType === "TENANT"
              ? "Manage your support tickets and user issues"
              : "View and track your support requests"}
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="btn-primary flex items-center gap-2 text-sm shadow-sm
                     self-start md:self-auto"
        >
          <Plus size={16} />
          New Ticket
        </button>
      </div>

      {/* Stats Cards */}
      <div
        className={`grid gap-4 ${
          userType === "TENANT" ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        <div className="card p-5 border border-slate-100 bg-white
                        flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400
                             uppercase tracking-wider">
              My Open Tickets
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

        <div className="card p-5 border border-slate-100 bg-white
                        flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400
                             uppercase tracking-wider">
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

        {userType === "TENANT" && (
          <div className="card p-5 border border-slate-100 bg-white
                          flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400
                               uppercase tracking-wider">
                User Tickets
              </span>
              <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
                <Users size={16} className="text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-slate-800">
                {userTicketsCount}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                {userOpenCount} open · {userTicketsCount - userOpenCount} handled
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs — TENANT ONLY */}
      {userType === "TENANT" && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("my")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                        font-semibold transition ${
              activeTab === "my"
                ? "bg-white text-[#125EF2] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <User size={15} />
            My Tickets
            {openCount > 0 && (
              <span className="inline-flex items-center justify-center
                               min-w-[18px] h-[18px] px-1 rounded-full
                               bg-[#125EF2] text-white text-[10px] font-bold">
                {openCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("user")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                        font-semibold transition ${
              activeTab === "user"
                ? "bg-white text-[#125EF2] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Users size={15} />
            User Tickets
            {userOpenCount > 0 && (
              <span className="inline-flex items-center justify-center
                               min-w-[18px] h-[18px] px-1 rounded-full
                               bg-purple-500 text-white text-[10px] font-bold">
                {userOpenCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Ticket List */}
      <div className="card border border-slate-100 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center
                          justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {activeTab === "my" ? "My Tickets" : "User Tickets"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredList.length} ticket
                {filteredList.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
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
                             focus:ring-[#125EF2]/20 w-36"
                />
              </div>
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
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                           font-semibold text-slate-500 hover:text-slate-700
                           hover:bg-slate-100 rounded-xl transition
                           border border-slate-200"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center
                          py-16 gap-3">
            <TicketCheck size={32} className="text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">
              No tickets found
            </p>
            <p className="text-xs text-slate-400">
              {activeTab === "my"
                ? "Click 'New Ticket' to raise your first support request"
                : "No user tickets yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredList.map((ticket) => {
              const lastMsg = ticket.messages?.[0];
              return (
                <div
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicket(ticket);
                    fetchTicketDetail(ticket.id);
                  }}
                  className="flex items-center justify-between px-6 py-4
                             hover:bg-slate-50 cursor-pointer transition gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#125EF2]">
                        {ticket.ticketNumber}
                      </span>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      {ticket.isEscalated && (
                        <span className="text-[10px] font-bold text-red-500">
                          ⚠️ Escalated
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800
                                  mt-1 truncate">
                      {ticket.title}
                    </p>
                    {lastMsg && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        Last: {lastMsg.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400 font-medium">
                        {formatDate(ticket.updatedAt || ticket.createdAt)}
                      </p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {ticket.category}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
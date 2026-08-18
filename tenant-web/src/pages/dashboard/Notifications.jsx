// tenant-web/src/pages/dashboard/Notifications.jsx
import React, { useEffect, useState } from "react";
import {
  Bell,
  MessageSquare,
  UserCheck,
  RefreshCw,
  Megaphone,
  TicketCheck,
  AlertCircle,
  CheckCircle2,
  Check,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import {
  getPaginatedNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
  deleteNotification,
} from "../../services/notification.service";

// Notification types available for tenant/user
const NOTIF_TYPES_TENANT = [
  { value: "all", label: "All Types" },
  { value: "new_ticket", label: "New Tickets" },
  { value: "ticket_reply", label: "Ticket Replies" },
  { value: "ticket_escalated", label: "Escalations" },
  { value: "ticket_status_updated", label: "Status Updates" },
  { value: "broadcast_completed", label: "Broadcasts" },
];

const NOTIF_TYPES_USER = [
  { value: "all", label: "All Types" },
  { value: "new_message", label: "New Messages" },
  { value: "contact_assigned", label: "Contact Assignments" },
  { value: "conversation_reopened", label: "Reopened Conversations" },
  { value: "ticket_reply", label: "Ticket Replies" },
  { value: "ticket_resolved", label: "Resolved Tickets" },
  { value: "ticket_status_updated", label: "Status Updates" },
];

export default function Notifications() {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const LIMIT = 20;
  const userType = authUser?.type;
  const NOTIF_TYPES = userType === "TENANT" ? NOTIF_TYPES_TENANT : NOTIF_TYPES_USER;

  // ── Fetch paginated ──
  const loadNotifications = async () => {
    setLoading(true);
    const res = await getPaginatedNotifications({
      page,
      limit: LIMIT,
      filter,
      type: typeFilter,
    });
    if (res.success) {
      setNotifications(res.data.notifications || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
      setUnreadCount(res.data.unreadCount || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [page, filter, typeFilter]);

  // ── Client-side search ──
  const filteredNotifs = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.message?.toLowerCase().includes(q)
    );
  });

  // ── Handlers ──
  const handleClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    const meta = notif.metadata || {};

    // Navigate based on type
    if (notif.type === "new_message" || notif.type === "conversation_reopened") {
      navigate(`/dashboard/inbox?conversationId=${meta.conversationId}`);
    } else if (notif.type === "contact_assigned") {
      navigate("/dashboard/contacts");
    } else if (notif.type === "broadcast_completed") {
      navigate("/dashboard/broadcasts");
    } else if (
      ["new_ticket", "ticket_reply", "ticket_escalated",
       "ticket_resolved", "ticket_status_updated"].includes(notif.type)
    ) {
      navigate("/dashboard/tickets");
    }
  };

  const handleMarkAllRead = async () => {
    const res = await markAllAsRead();
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    const res = await clearAll();
    if (res.success) {
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
      setPage(1);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this notification?")) return;
    const res = await deleteNotification(id);
    if (res.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    }
  };

  // ── Icon by type ──
  const getNotifIcon = (type) => {
    const iconMap = {
      new_message: { bg: "bg-green-100", color: "text-green-600", Icon: MessageSquare },
      contact_assigned: { bg: "bg-blue-100", color: "text-blue-600", Icon: UserCheck },
      conversation_reopened: { bg: "bg-amber-100", color: "text-amber-600", Icon: RefreshCw },
      broadcast_completed: { bg: "bg-purple-100", color: "text-purple-600", Icon: Megaphone },
      new_ticket: { bg: "bg-blue-100", color: "text-blue-600", Icon: TicketCheck },
      ticket_reply: { bg: "bg-indigo-100", color: "text-indigo-600", Icon: MessageSquare },
      ticket_escalated: { bg: "bg-orange-100", color: "text-orange-600", Icon: AlertCircle },
      ticket_resolved: { bg: "bg-emerald-100", color: "text-emerald-600", Icon: CheckCircle2 },
      ticket_status_updated: { bg: "bg-emerald-100", color: "text-emerald-600", Icon: CheckCircle2 },
    };

    const config = iconMap[type] || { bg: "bg-gray-100", color: "text-gray-600", Icon: Bell };
    const { bg, color, Icon } = config;

    return (
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={color} />
      </div>
    );
  };

  // ── Format time ──
  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#125EF2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total} total • {unreadCount} unread
              {userType === "USER" && (
                <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                  Personal
                </span>
              )}
              {userType === "TENANT" && (
                <span className="ml-2 text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-semibold">
                  Admin
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#125EF2] hover:bg-blue-50 rounded-xl transition"
            >
              <Check className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-50 rounded-xl p-1">
          {["all", "unread", "read"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold capitalize rounded-lg transition ${
                filter === f
                  ? "bg-white text-[#125EF2] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {NOTIF_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-slate-300 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading notifications...</p>
          </div>
        ) : filteredNotifs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {searchQuery
                ? "No matching notifications"
                : filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? "Try a different search term" : "You're all caught up!"}
            </p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`group flex items-start gap-3 px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition ${
                !notif.isRead ? "bg-blue-50/30" : ""
              }`}
            >
              {getNotifIcon(notif.type)}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm text-slate-800 ${!notif.isRead ? "font-bold" : "font-semibold"}`}>
                    {notif.title}
                  </p>
                  <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">
                    {formatTime(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {notif.message}
                </p>
              </div>

              <div className="flex flex-col items-center gap-2 shrink-0">
                {!notif.isRead && (
                  <span className="w-2 h-2 bg-[#125EF2] rounded-full mt-2" />
                )}
                <button
                  onClick={(e) => handleDelete(e, notif.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-lg transition"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex justify-between items-center mt-4 bg-white rounded-xl border border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#125EF2] text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
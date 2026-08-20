// admin-web/src/pages/dashboard/Notifications.jsx
import React, { useEffect, useState } from "react";
import {
  Bell,
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  Check,
  Trash2,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAdminNotificationsPaginated,
  markAdminNotifAsRead,
  markAllAdminNotifsAsRead,
  clearAllAdminNotifs,
  deleteAdminNotif,
} from "../../services/notification.service";
import { useNotificationStore } from "../../store/useNotificationStore";
import { getAdminSocket } from "../../lib/socket";
import { useAdminAuthStore } from "../../store/useAdminAuthStore";

const NOTIF_TYPES = [
  { value: "all", label: "All Types" },
  { value: "tenant_payment", label: "Payments" },
  { value: "tenant_registered", label: "New Tenants" },
  { value: "plan_upgraded", label: "Upgrades" },
  { value: "tenant_suspended", label: "Suspensions" },
  { value: "whatsapp_connected",    label: "WA Connected" },
  { value: "whatsapp_disconnected", label: "WA Disconnected" },
];

const Notifications = () => {
  const navigate = useNavigate();
  const { fetchNotifications: refreshDropdown } = useNotificationStore();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all"); // all | unread | read
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const LIMIT = 20;

  // ── Fetch paginated notifications ──
  const loadNotifications = async () => {
    setLoading(true);
    const res = await getAdminNotificationsPaginated({
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

    // ✅ Live socket listener for real-time SuperAdmin notifications on this page
  useEffect(() => {
    const token = useAdminAuthStore.getState().accessToken;
    if (!token) return;

    const socket = getAdminSocket();
    if (!socket) return;

    const handleLiveAdminNotification = (data) => {
      if (!data?.notification) return;

      const newNotif = data.notification;
      console.log("🔔 Live SuperAdmin notification received on page:", newNotif);

      // Check if incoming notification matches active filters
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !newNotif.isRead) ||
        (filter === "read" && newNotif.isRead);

      const matchesType =
        typeFilter === "all" || typeFilter === newNotif.type;

      // Only insert into the current list view if on Page 1 & matches filters
      if (matchesFilter && matchesType && page === 1) {
        setNotifications((prev) => {
          // Prevent duplicates
          if (prev.some((n) => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev].slice(0, LIMIT);
        });
      }

      // Always increment counts if unread
      if (!newNotif.isRead) {
        setUnreadCount((c) => c + 1);
        setTotal((t) => t + 1);
      }
    };

    socket.on("superadmin_notification", handleLiveAdminNotification);

    return () => {
      socket.off("superadmin_notification", handleLiveAdminNotification);
    };
  }, [filter, typeFilter, page]);

  // ── Filtered notifications (client-side search) ──
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
      await markAdminNotifAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      refreshDropdown();
    }

    const meta = notif.metadata || {};
    switch (notif.type) {
      case "tenant_payment":
        navigate(
          meta.tenantId
            ? `/dashboard/tenants?highlight=${meta.tenantId}`
            : "/dashboard/revenue"
        );
        break;
      case "tenant_registered":
        navigate("/dashboard/tenants");
        break;
      case "plan_upgraded":
        navigate("/dashboard/revenue");
        break;
      case "tenant_suspended":
        navigate("/dashboard/tenants");
        break;
      default:
        navigate("/dashboard");
    }
  };

  const handleMarkAllRead = async () => {
    const res = await markAllAdminNotifsAsRead();
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
      refreshDropdown();
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    const res = await clearAllAdminNotifs();
    if (res.success) {
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
      setPage(1);
      refreshDropdown();
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this notification?")) return;
    const res = await deleteAdminNotif(id);
    if (res.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      refreshDropdown();
    }
  };

  // ── Icon per notif type ──
  const getNotifIcon = (type) => {
    switch (type) {
      case "tenant_payment":
        return (
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-emerald-600" />
          </div>
        );
      case "tenant_registered":
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Users size={18} className="text-blue-600" />
          </div>
        );
      case "plan_upgraded":
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-purple-600" />
          </div>
        );
      case "tenant_suspended":
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-600" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-gray-600" />
          </div>
        );
    }
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
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#125EF2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Notifications
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total} total • {unreadCount} unread
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin" : ""
                }`}
            />
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

      {/* ── Filters Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 flex flex-wrap items-center gap-3">
        {/* Read/Unread tabs */}
        <div className="flex gap-1 bg-slate-50 rounded-xl p-1">
          {["all", "unread", "read"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold capitalize rounded-lg transition ${filter === f
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

        {/* Type filter */}
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

        {/* Search */}
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

      {/* ── Notifications List ── */}
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
              {searchQuery
                ? "Try a different search term"
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`group flex items-start gap-3 px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition ${!notif.isRead ? "bg-blue-50/30" : ""
                }`}
            >
              {getNotifIcon(notif.type)}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm text-slate-800 ${!notif.isRead ? "font-bold" : "font-semibold"
                      }`}
                  >
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

      {/* ── Pagination ── */}
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
};

export default Notifications;
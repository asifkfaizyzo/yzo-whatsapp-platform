// admin-web/src/components/TopNavBar.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  User,
  LogOut,
  ChevronDown,
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { logoutSuperAdmin } from "../lib/authApi";
import { useAdminAuthStore } from "../store/useAdminAuthStore";
import { useNotificationStore } from "../store/useNotificationStore";

const TopNavbar = () => {
  const navigate = useNavigate();
  const user = useAdminAuthStore((state) => state.user);

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationStore();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  // ── Fetch notifications on mount ──
  useEffect(() => {
    fetchNotifications();
  }, []);

  // ── Socket: join superadmin room + listen for payment events ──
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ Admin socket connected:", socket.id);
      // Join dedicated superadmin room
      socket.emit("join_superadmin");
      console.log("✅ Joined superadmin room");
    });

    // ── Listen for tenant payment notification ──
    socket.on("superadmin_notification", (data) => {
      console.log("🔔 SuperAdmin notification received:", data);
      const { notification } = data;
      addNotification(notification);
      playNotificationSound();
    });

    socket.on("disconnect", () => {
      console.log("🔌 Admin socket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Notification sound ──
  const playNotificationSound = () => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.3;
      audio.play();
    } catch (err) {
      // silent fail
    }
  };

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Handlers ──
  const handleLogout = async () => {
    setShowDropdown(false);
    await logoutSuperAdmin();
    navigate("/login");
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    const meta = notification.metadata || {};

    // Navigate based on notification type
    switch (notification.type) {
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

    setShowNotifications(false);
  };

  // ── Icon per notification type ──
  const getNotifIcon = (type) => {
    switch (type) {
      case "tenant_payment":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CreditCard size={14} className="text-emerald-600" />
          </div>
        );
      case "tenant_registered":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Users size={14} className="text-blue-600" />
          </div>
        );
      case "plan_upgraded":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-purple-600" />
          </div>
        );
      case "tenant_suspended":
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={14} className="text-red-600" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <Bell size={14} className="text-gray-600" />
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
    return `${days}d ago`;
  };

  return (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3 h-16 relative z-30">

      {/* ── Left: Logo ── */}
      <div className="flex items-center gap-2">
        <img
          src="/sudo_bg.png"
          alt="SudoReply Logo"
          className="h-8 w-auto"
        />
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-4">

        {/* ── Notification Bell ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowDropdown(false);
            }}
            className="text-gray-500 hover:text-gray-800 p-2 rounded-xl hover:bg-gray-50 transition relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* ── Notification Dropdown ── */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-100 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">

              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-slate-600" />
                  <span className="text-sm font-bold text-slate-800">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] text-[#125EF2] font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition flex items-center gap-1"
                    >
                      <Check size={11} />
                      All read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-red-500 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition flex items-center gap-1"
                    >
                      <X size={11} />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                      <Bell size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      No notifications yet
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      You're all caught up!
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`
                        w-full text-left px-4 py-3 flex items-start gap-3
                        border-b border-slate-50 transition duration-150
                        hover:bg-slate-50
                        ${!notif.isRead ? "bg-blue-50/40" : ""}
                      `}
                    >
                      {getNotifIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs text-slate-800 truncate ${!notif.isRead
                              ? "font-bold"
                              : "font-semibold"
                            }`}
                        >
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <span className="w-2 h-2 bg-[#125EF2] rounded-full shrink-0 mt-1" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400">
                    Showing last {notifications.length} notifications
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User Dropdown ── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition duration-150"
          >
            <div className="w-8 h-8 rounded-lg bg-[#CFE0FD] flex items-center justify-center text-[#0F4FCC] font-semibold text-sm">
              {user?.name ? (
                user.name.charAt(0).toUpperCase()
              ) : (
                <User size={16} />
              )}
            </div>
            <div className="hidden md:flex flex-col text-left mr-1">
              <span className="text-xs font-semibold text-slate-800 leading-none">
                {user?.name || "Super Admin"}
              </span>
              <span className="text-[9px] text-gray-400 capitalize mt-0.5 font-medium">
                Super Admin
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-gray-500 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""
                }`}
            />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-gray-100 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">
                  Signed in as
                </p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
                  {user?.name || "Super Admin"}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {user?.email || "admin@company.com"}
                </p>
              </div>
              <div className="py-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors duration-150 font-semibold"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;
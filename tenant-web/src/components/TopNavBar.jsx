// src/components/TopNavBar.jsx

import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  User,
  LogOut,
  ChevronDown,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  RefreshCw,
  Megaphone,
  X,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth.service";
import { useAuthStore } from "../store/useAuthStore";
import { io } from "socket.io-client";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,  
} from "../services/notification.service";

export default function TopNavBar() {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();

  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  // ── Load user from localStorage ──
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user:", error);
    }
  }, []);

  // ── Load notifications from API ──
  const loadNotifications = async () => {
    const res = await getNotifications();
    if (res.success) {
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // ── Socket: listen for new notifications ──
  useEffect(() => {
    console.log("authUser in TopNavBar:", authUser);

    const tenantId = authUser?.type === "TENANT"
      ? authUser?.id
      : authUser?.tenantId;

    console.log("tenantId for socket:", tenantId);

    if (!tenantId) {
      console.log("❌ No tenantId - socket not connecting");
      return;
    }

    const socket = io(import.meta.env.VITE_BACKEND_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ TopNavBar socket connected:", socket.id);
      socket.emit("join_tenant", tenantId);
      console.log("✅ Joined tenant room:", tenantId);
    });

    socket.on("new_notification", (data) => {
      console.log("🔔 New notification received:", data);
      const { notification } = data;
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
      playNotificationSound();
    });

    return () => {
      console.log("🔌 TopNavBar socket disconnecting");
      socket.disconnect();
    };
  }, [authUser]);

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

  // ── Close dropdowns when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
    await logout();
    navigate("/login");
  };

  const handleMarkAsRead = async (id) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleClearAll = async () => {
    await clearAll();
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    const meta = notification.metadata || {};

    if (
      notification.type === "new_message" ||
      notification.type === "conversation_reopened"
    ) {
      navigate(`/dashboard/inbox?conversationId=${meta.conversationId}`);
    }

    if (notification.type === "contact_assigned") {
      navigate(`/dashboard/contacts`);
    }

    if (notification.type === "broadcast_completed") {
      navigate(`/dashboard/broadcasts`);
    }

    setShowNotifications(false);
  };

  // ── Notification icon by type ──
  const getNotifIcon = (type) => {
    switch (type) {
      case "new_message":
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-green-600" />
          </div>
        );
      case "contact_assigned":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <UserCheck size={14} className="text-blue-600" />
          </div>
        );
      case "conversation_reopened":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <RefreshCw size={14} className="text-amber-600" />
          </div>
        );
      case "broadcast_completed":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <Megaphone size={14} className="text-purple-600" />
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
    <header className="flex items-center justify-between bg-white border-b border-[color:var(--border)] px-6 py-3 h-16 relative z-30 shrink-0">

      {/* Left: Brand Logo */}
      <div className="flex items-center gap-2">
        <img
          src="/sudo_bg.png"
          alt="SudoReply Logo"
          className="h-8 w-auto"
        />
        <span className="text-xl font-bold text-gray-800 tracking-tight">
          {user?.tenantName || user?.companyName}
        </span>
      </div>

      {/* Middle: WhatsApp API Status */}
      <div className="hidden sm:flex items-center gap-2 rounded-full bg-[#EAF2FE] border border-[#CFE0FD] px-3.5 py-1.5">
        <CheckCircle2 size={15} className="text-[#125EF2] animate-pulse" />
        <span className="text-xs font-semibold text-[#0D47A1]">
          WhatsApp Cloud API: Connected
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">

        {/* ── Notification Bell ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowDropdown(false);
            }}
            className="text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-50 transition relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-100 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">

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
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-[#125EF2] font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition flex items-center gap-1"
                    >
                      <Check size={11} />
                      All read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
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
                        <p className={`text-xs text-slate-800 truncate ${!notif.isRead ? "font-bold" : "font-semibold"}`}>
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

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition duration-150"
          >
            <div className="w-8 h-8 rounded-xl bg-[#CFE0FD] flex items-center justify-center text-[#125EF2] font-semibold text-sm border border-[#CFE0FD]">
              {user?.name
                ? user.name.charAt(0).toUpperCase()
                : user?.tenantName
                ? user.tenantName.charAt(0).toUpperCase()
                : <User size={16} />}
            </div>
            <div className="hidden md:flex flex-col text-left mr-1">
              <span className="text-xs font-semibold text-slate-800 leading-none">
                {user?.name || user?.tenantName || "Tenant Member"}
              </span>
              <span className="text-[9px] text-[color:var(--muted)] capitalize mt-0.5 font-medium">
                {user?.type === "TENANT" ? "Admin" : "Agent"}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform duration-200 ${
                showDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-slate-100 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
                  Signed in as
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
                  {user?.name || user?.tenantName || "Tenant Admin"}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {user?.email || "tenant@company.com"}
                </p>
              </div>
              <div className="py-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors duration-150 font-semibold"
                >
                  <LogOut size={15} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
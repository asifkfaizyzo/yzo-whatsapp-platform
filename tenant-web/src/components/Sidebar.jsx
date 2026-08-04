// src/components/Sidebar.jsx

import React from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import api from "../lib/axios";
import {
  LayoutDashboard,
  Inbox,
  Megaphone,
  FileCode,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  UserCheck2,
  UserX,
  ShieldOff,
  UsersRound,
  CreditCard,
  Bot,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

export default function Sidebar({ userRole, tenantStatus = "APPROVED" }) {
  const isAdmin = userRole === "admin";
  const isPending = tenantStatus === "PENDING";
  const location = useLocation();

  const [inboxOpen, setInboxOpen] = React.useState(() =>
    location.pathname.startsWith("/dashboard/inbox")
  );
  const [contactsOpen, setContactsOpen] = React.useState(() =>
    location.pathname.startsWith("/dashboard/contacts")
  );

  const [inboxUnreadCount, setInboxUnreadCount] = React.useState(
    parseInt(localStorage.getItem("inbox_unread_count") || "0", 10)
  );

  // Collapse/Expand state persisted in localStorage
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Mobile overlay state
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const handleUpdate = () => {
      setInboxUnreadCount(
        parseInt(localStorage.getItem("inbox_unread_count") || "0", 10)
      );
    };
    window.addEventListener("unread_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("unread_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  React.useEffect(() => {
    if (location.pathname.startsWith("/dashboard/inbox")) {
      setInboxOpen(true);
    }
    if (location.pathname.startsWith("/dashboard/contacts")) {
      setContactsOpen(true);
    }
  }, [location.pathname]);

  const [subStatus, setSubStatus] = React.useState(null);

  React.useEffect(() => {
    api.get("/billing")
      .then(res => {
        if (res.data?.success) {
          setSubStatus(res.data.data.subscriptionStatus);
        }
      })
      .catch(err => {
        console.error("Failed to fetch sub status in Sidebar:", err);
      });
  }, [location.pathname]);

  const isSubItemActive = (path, filterValue) => {
    if (location.pathname !== path) return false;
    const searchParams = new URLSearchParams(location.search);
    const activeFilter = searchParams.get("filter");

    if (!activeFilter) {
      const isInbox = path.startsWith("/dashboard/inbox");
      const defaultVal = isInbox ? (isAdmin ? "all" : "my") : "all";
      return filterValue === defaultVal;
    }
    return activeFilter === filterValue;
  };

  const allMenuItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
      adminOnly: false,
      end: true,
    },
    {
      label: "Inbox",
      path: "/dashboard/inbox",
      icon: <Inbox size={20} />,
      adminOnly: false,
      restrictedForPending: true,
      hasDropdown: true,
      dropdownItems: isAdmin
        ? [
          {
            label: "WhatsApp",
            path: "/dashboard/inbox?filter=all",
            filterValue: "all",
            unreadCount : inboxUnreadCount,
          },
        ]
        : [
          {
            label: "WhatsApp",
            path: "/dashboard/inbox?filter=my",
            filterValue: "my",
            unreadCount : inboxUnreadCount,
          },
        ],
    },
    {
      label: "Broadcasts",
      path: "/dashboard/broadcasts",
      icon: <Megaphone size={20} />,
      adminOnly: true,
      restrictedForPending: true,
    },
    {
      label: "Templates",
      path: "/dashboard/templates",
      icon: <FileCode size={20} />,
      adminOnly: true,
      restrictedForPending: true,
    },
    {
      label: "Automation",
      path: "/dashboard/automation",
      icon: <Bot size={20} />,
      adminOnly: true,
      restrictedForPending: true
    },
    
    {
      label: "Contacts",
      path: "/dashboard/contacts",
      icon: <Users size={20} />,
      adminOnly: false,
      restrictedForPending: true,
      hasDropdown: isAdmin,
      dropdownItems: isAdmin
        ? [
            {
              label: "All Contacts",
              path: "/dashboard/contacts?filter=all",
              filterValue: "all",
              icon: <UsersRound size={13} />,
              badgeClass: "bg-blue-50 text-blue-600",
            },
            {
              label: "Assigned",
              path: "/dashboard/contacts?filter=assigned",
              filterValue: "assigned",
              icon: <UserCheck2 size={13} />,
              badgeClass: "bg-green-50 text-green-600",
            },
            {
              label: "Unassigned",
              path: "/dashboard/contacts?filter=unassigned",
              filterValue: "unassigned",
              icon: <UserX size={13} />,
              badgeClass: "bg-amber-50 text-amber-600",
            },
            {
              label: "Blocked",
              path: "/dashboard/contacts?filter=blocked",
              filterValue: "blocked",
              icon: <ShieldOff size={13} />,
              badgeClass: "bg-red-50 text-red-500",
            },
          ]
        : null,
    },
    {
      label: "Team",
      path: "/dashboard/team",
      icon: <UserCheck size={20} />,
      adminOnly: true,
      restrictedForPending: true,
    },
    {
      label: "Reports",
      path: "/dashboard/reports",
      icon: <BarChart3 size={20} />,
      adminOnly: true,
      restrictedForPending: true,
    },
    {
      label: "Billing",
      path: "/dashboard/billing",
      icon: <CreditCard size={20} />,
      adminOnly: true,
      restrictedForPending: false,
    },
    {
      label: "Settings",
      path: "/dashboard/settings",
      icon: <Settings size={20} />,
      adminOnly: false,
    },
  ];

  const isTenant = userRole === "admin";
  const menuItems = allMenuItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.label === "Billing" && !isTenant) return false;
    return true;
  });

  // Split menu items into "Menu" and "Other" groups
  const mainMenuLabels = ["Dashboard", "Inbox", "Broadcasts", "Templates", "Automation", "Contacts", "Team", "Reports"];
  const mainMenu = menuItems.filter(item => mainMenuLabels.includes(item.label));
  const otherMenu = menuItems.filter(item => !mainMenuLabels.includes(item.label));

  // ── Render a menu item ──
  const renderMenuItem = (item) => {
    const isExpired = subStatus === "expired";
    const locked = (item.restrictedForPending && isPending) || (isExpired && item.label !== "Billing");

    // ── Locked Item ──
    if (locked) {
      return (
        <div
          key={item.path}
          className="group relative flex items-center justify-between gap-3 rounded-[10px] px-4 py-3 text-sm font-medium text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-60"
          title={isExpired ? "Subscription expired: Resubscribe to unlock" : "Under review: Unlocks after approval"}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-5 min-w-[20px] h-5">{item.icon}</span>
            <span className={`transition-all duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden absolute" : "opacity-100"}`}>{item.label}</span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 transition-all duration-200 ${collapsed ? "hidden" : ""}`}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="sidebar-tooltip pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
              {item.label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
            </div>
          )}
        </div>
      );
    }

    // ── Dropdown Item ──
    if (item.hasDropdown) {
      const isOpen = item.label === "Inbox" ? inboxOpen : contactsOpen;
      const isParentActive = location.pathname.startsWith(item.path);
      const defaultSubPath = item.dropdownItems[0].path;

      return (
        <div key={item.path}>
          <NavLink
            to={defaultSubPath}
            className={`group relative flex items-center justify-between rounded-[10px] px-4 py-3 text-sm font-medium transition-all duration-200
              ${isParentActive
                ? "bg-[#125EF2] text-white font-semibold shadow-md shadow-blue-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              } ${collapsed ? "justify-center px-3" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-5 min-w-[20px] h-5">{item.icon}</span>
              <span className={`transition-all duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden absolute" : "opacity-100"}`}>{item.label}</span>
            </div>
            {!collapsed && (
              <button
                className={`p-1 rounded-md transition-all duration-150 ${isParentActive ? "hover:bg-white/20 text-white" : "hover:bg-slate-200/70 text-slate-400 hover:text-slate-700"}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item.label === "Inbox") setInboxOpen(!inboxOpen);
                  if (item.label === "Contacts") setContactsOpen(!contactsOpen);
                }}
              >
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            {/* Tooltip when collapsed */}
            {collapsed && (
              <div className="sidebar-tooltip pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
              </div>
            )}
          </NavLink>

          {/* Dropdown Sub Items */}
          {isOpen && !collapsed && (
            <div className="pl-6 ml-5 mt-1 border-l border-slate-200 flex flex-col gap-0.5 animate-fade-in-slide">
              {item.dropdownItems.map((subItem) => {
                const isActive = isSubItemActive(item.path, subItem.filterValue);
                const isInbox = item.label === "Inbox";

                if (isInbox) {
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                        ${isActive
                          ? "bg-[#EAF2FE] text-[#125EF2] font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 bg-green-100 text-green-600">
                        <FaWhatsapp className="w-3 h-3" />
                      </span>
                      <span>{subItem.label}</span>
                      {subItem.unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                          {subItem.unreadCount > 99 ? "99+" : subItem.unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                }

                // Contacts sub-item
                return (
                  <Link
                    key={subItem.path}
                    to={subItem.path}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                      ${isActive
                        ? "bg-[#EAF2FE] text-[#125EF2] font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${subItem.badgeClass || "bg-blue-50 text-blue-600"}`}>
                      {subItem.icon}
                    </span>
                    <span>{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // ── Regular Item ──
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.end}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm font-medium transition-all duration-200
          ${isActive
            ? "bg-[#125EF2] text-white font-semibold shadow-md shadow-blue-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          } ${collapsed ? "justify-center px-3" : ""}`
        }
      >
        <span className="flex items-center justify-center w-5 min-w-[20px] h-5">{item.icon}</span>
        <span className={`transition-all duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden absolute" : "opacity-100"}`}>{item.label}</span>
        {/* Tooltip when collapsed */}
        {collapsed && (
          <div className="sidebar-tooltip pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
            {item.label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Sidebar Spacer — pushes content right */}
      <div
        className={`hidden md:block shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${collapsed ? "w-[72px]" : "w-[260px]"}`}
      />

      {/* Mobile Overlay Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[45] transition-opacity duration-300 md:hidden ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile Floating Trigger */}
      <button
        className="fixed bottom-5 left-5 z-[44] w-12 h-12 bg-[#125EF2] text-white rounded-[14px] flex items-center justify-center shadow-lg shadow-blue-500/40 hover:scale-105 active:scale-95 transition-transform duration-200 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      {/* ── Main Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-slate-200 flex flex-col z-40 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
          ${collapsed ? "w-[72px]" : "w-[260px]"}
          max-md:-translate-x-full max-md:w-[280px] max-md:z-50
          ${mobileOpen ? "max-md:translate-x-0" : ""}`}
      >
        {/* ── Brand / Logo Area ── */}
        <div className={`flex items-center justify-between px-4 py-5 min-h-[64px] ${collapsed ? "justify-center px-2" : ""}`}>
          <div className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap">
            <img
              src="/sudo_bg.png"
              alt="SudoReply Logo"
              className="h-8 w-8 min-w-[32px] rounded-lg object-contain"
            />
            <span className={`text-lg font-bold text-slate-800 tracking-tight transition-all duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
              SudoReply
            </span>
          </div>
          {/* Desktop collapse toggle */}
          <button
            className={`hidden md:flex items-center justify-center w-7 h-7 min-w-[28px] rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all duration-200 ${collapsed ? "!hidden" : ""}`}
            onClick={toggleCollapse}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
          {/* Mobile close button */}
          <button
            className="md:hidden flex items-center justify-center w-7 h-7 min-w-[28px] rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all duration-200"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Collapsed expand button (centered) */}
        {collapsed && (
          <div className="hidden md:flex justify-center pb-2">
            <button
              className="flex items-center justify-center w-9 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all duration-200"
              onClick={toggleCollapse}
              aria-label="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sidebar-scroll-area">

          {/* User Role Indicator Card */}
          {!collapsed ? (
            <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[11px] text-slate-400 font-medium">Active Role</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[13px] font-semibold text-slate-800 capitalize">
                  {userRole || "User"}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border
                    ${isPending
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : isAdmin
                        ? "bg-blue-50 text-[#125EF2] border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                >
                  {isPending ? "Pending Review" : isAdmin ? "Full Access" : "Agent View"}
                </span>
              </div>
            </div>
          ) : (
            /* Collapsed: show just a small avatar circle */
            <div className="hidden md:flex justify-center mb-3">
              <div className="group relative w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold uppercase">
                {(userRole || "U").charAt(0)}
                {/* Tooltip */}
                <div className="sidebar-tooltip pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 z-50 shadow-lg">
                  {isPending ? "Pending Review" : isAdmin ? "Admin — Full Access" : "Agent View"}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
                </div>
              </div>
            </div>
          )}

          {/* ── Menu Section ── */}
          {!collapsed ? (
            <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-[0.5px] px-4 pt-3 pb-2">Menu</p>
          ) : (
            <div className="hidden md:block mx-auto my-2 w-5 h-px bg-slate-200" />
          )}
          <nav className="flex flex-col gap-1">
            {mainMenu.map(renderMenuItem)}
          </nav>

          {/* ── Other Section ── */}
          {otherMenu.length > 0 && (
            <>
              <div className={`my-2 h-px bg-slate-200 ${collapsed ? "mx-2" : "mx-4"}`} />
              {!collapsed ? (
                <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-[0.5px] px-4 pt-1 pb-2">Other</p>
              ) : (
                <div className="hidden md:block mx-auto my-2 w-5 h-px bg-slate-200" />
              )}
              <nav className="flex flex-col gap-1">
                {otherMenu.map(renderMenuItem)}
              </nav>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-slate-100 py-3 px-4 text-center">
          <p className={`text-[11px] text-slate-400 font-medium transition-all duration-200 ${collapsed ? "text-[9px]" : ""}`}>
            {collapsed ? "v1.0" : "sudoreply v1.0.0"}
          </p>
        </div>
      </aside>
    </>
  );
}
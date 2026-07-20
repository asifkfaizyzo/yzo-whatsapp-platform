// src/components/Sidebar.jsx

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  TicketCheck,
  Bot,
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
  adminOnly: true,           // only tenant admin
  restrictedForPending: true // locked if pending
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
          iconBg: "bg-blue-50",
          iconColor: "text-blue-500",
        },
        {
          label: "Assigned",
          path: "/dashboard/contacts?filter=assigned",
          filterValue: "assigned",
          icon: <UserCheck2 size={13} />,
          iconBg: "bg-green-50",
          iconColor: "text-green-500",
        },
        {
          label: "Unassigned",
          path: "/dashboard/contacts?filter=unassigned",
          filterValue: "unassigned",
          icon: <UserX size={13} />,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-500",
        },
        {
          label: "Blocked",
          path: "/dashboard/contacts?filter=blocked",
          filterValue: "blocked",
          icon: <ShieldOff size={13} />,
          iconBg: "bg-red-50",
          iconColor: "text-red-400",
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
      adminOnly: true,       // ✅ Only TENANT (admin) sees this
      restrictedForPending: false, // ✅ Visible even if pending
    },
    {
  label: "Support Tickets",
  path: "/dashboard/tickets",
  icon: <TicketCheck size={20} />,
  adminOnly: false, // ✅ Visible to both TENANT (admin) and AGENT (user)
  restrictedForPending: false, // visible even if pending
},
    {
      label: "Settings",
      path: "/dashboard/settings",
      icon: <Settings size={20} />,
      adminOnly: false,
    },
  ];

  const isTenant = userRole === "admin"; // In your app, TENANT = admin role
const menuItems = allMenuItems.filter((item) => {
  if (item.adminOnly && !isAdmin) return false;
  // Billing only visible to tenant (admin), not agents/users
  if (item.label === "Billing" && !isTenant) return false;
  return true;
});

  return (
    <aside className="w-64 bg-white border-r border-[color:var(--border)] flex flex-col justify-between min-h-[calc(100vh-64px)] shrink-0">
      <div className="flex flex-col py-6 px-4">

        {/* User Role Indicator Card */}
        <div className="mb-6 rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-xs text-[color:var(--muted)] font-medium">Active Role</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-semibold capitalize text-slate-800">
              {userRole || "User"}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${isPending
                  ? "bg-amber-50 text-amber-700 border border-amber-100"
                  : isAdmin
                    ? "bg-[#EAF2FE] text-[#125EF2] border border-[#CFE0FD]"
                    : "bg-blue-50 text-blue-700 border border-blue-100"
                }`}
            >
              {isPending ? "Pending Review" : isAdmin ? "Full Access" : "Agent View"}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isExpired = subStatus === "expired";
            const locked = (item.restrictedForPending && isPending) || (isExpired && item.label !== "Billing");
 
            // ── Locked Item ──
            if (locked) {
              return (
                <div
                  key={item.path}
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-400 cursor-not-allowed opacity-65 bg-slate-50/50"
                  title={isExpired ? "Subscription expired: Resubscribe to unlock" : "Under review: Unlocks after approval"}
                >
                  <div className="flex items-center gap-3.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-400 shrink-0"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              );
            }

            // ── Dropdown Item ──
            if (item.hasDropdown) {
              const isOpen = item.label === "Inbox" ? inboxOpen : contactsOpen;
              const isParentActive = location.pathname.startsWith(item.path);
              const defaultSubPath = item.dropdownItems[0].path;

              return (
                <div key={item.path} className="space-y-1">

                  {/* Parent Link */}
                  <NavLink
                    to={defaultSubPath}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${isParentActive
                        ? "bg-[#EAF2FE] text-[#125EF2] font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="transition-transform duration-200">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.label === "Inbox") setInboxOpen(!inboxOpen);
                        if (item.label === "Contacts") setContactsOpen(!contactsOpen);
                      }}
                      className="p-1 hover:bg-[#CFE0FD] hover:text-[#0D47A1] rounded-md transition"
                    >
                      {isOpen ? (
                        <ChevronUp size={14} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                    </span>
                  </NavLink>

                  {/* Dropdown Sub Items */}

{isOpen && (
  <div className="pl-6 space-y-1 ml-3 border-l border-slate-100 animate-in fade-in duration-200">
    {item.dropdownItems.map((subItem) => {
      const isActive = isSubItemActive(item.path, subItem.filterValue);
      const isInbox = item.label === "Inbox";

      // ── Inbox sub-item (WhatsApp style — unchanged) ──
      if (isInbox) {
        return (
          <NavLink
            key={subItem.path}
            to={subItem.path}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition duration-150 ${
              isActive
                ? "bg-slate-50 text-[#125EF2] font-semibold border-l-2 border-[#125EF2] pl-3.5"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 pl-3.5"
            }`}
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 shrink-0">
              <FaWhatsapp className="w-3.5 h-3.5 text-green-600" />
            </span>
            <span className="text-green-600">{subItem.label}</span>
            {subItem.unreadCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-green-100 text-green-600 text-[12px] font-bold">
                {subItem.unreadCount > 99 ? "99+" : subItem.unreadCount}
              </span>
            )}
          </NavLink>
        );
      }

      // ── Contacts sub-item (icon badges) ──
      return (
        <NavLink
          key={subItem.path}
          to={subItem.path}
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition duration-150 ${
            isActive
              ? "bg-slate-50 text-[#125EF2] font-semibold border-l-2 border-[#125EF2] pl-3.5"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 pl-3.5"
          }`}
        >
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${subItem.iconBg}`}>
            <span className={subItem.iconColor}>{subItem.icon}</span>
          </span>
          <span className={isActive ? "text-[#125EF2]" : "text-slate-600"}>
            {subItem.label}
          </span>
        </NavLink>
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
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${isActive
                    ? "bg-[#EAF2FE] text-[#125EF2] border-l-4 border-[#125EF2] font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <span className="transition-transform duration-200 group-hover:scale-110">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );

          })}
        </nav>

      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[color:var(--border)]">
        <p className="text-[11px] text-[color:var(--muted)] text-center font-medium">
          sudoreply v1.0.0
        </p>
      </div>
    </aside>
  );
}
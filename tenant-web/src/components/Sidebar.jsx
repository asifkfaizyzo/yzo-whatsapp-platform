// src/components/Sidebar.jsx

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
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

  React.useEffect(() => {
    if (location.pathname.startsWith("/dashboard/inbox")) {
      setInboxOpen(true);
    }
    if (location.pathname.startsWith("/dashboard/contacts")) {
      setContactsOpen(true);
    }
  }, [location.pathname]);

  const isSubItemActive = (path, filterValue) => {
    if (location.pathname !== path) return false;
    const searchParams = new URLSearchParams(location.search);
    const activeFilter = searchParams.get("filter");
    
    if (!activeFilter) {
      const isInbox = path.startsWith("/dashboard/inbox");
      const defaultVal = isInbox 
        ? (isAdmin ? "all" : "my")
        : "all";
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
            { label: "WhatsApp", path: "/dashboard/inbox?filter=all", filterValue: "all" },
            // { label: "Assigned", path: "/dashboard/inbox?filter=assigned", filterValue: "assigned" },
            // { label: "Unassigned", path: "/dashboard/inbox?filter=unassigned", filterValue: "unassigned" },
            // { label: "Closed", path: "/dashboard/inbox?filter=closed", filterValue: "closed" },
          ]
        : [
            { label: "My Chats", path: "/dashboard/inbox?filter=my", filterValue: "my" },
            { label: "Closed", path: "/dashboard/inbox?filter=closed", filterValue: "closed" },
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
      label: "Contacts",
      path: "/dashboard/contacts",
      icon: <Users size={20} />,
      adminOnly: false,
      restrictedForPending: true,
      hasDropdown: isAdmin, // Only Admin (Tenant) gets contacts dropdown
      dropdownItems: isAdmin
        ? [
            { label: "All", path: "/dashboard/contacts?filter=all", filterValue: "all" },
            { label: "Assigned", path: "/dashboard/contacts?filter=assigned", filterValue: "assigned" },
            { label: "Unassigned", path: "/dashboard/contacts?filter=unassigned", filterValue: "unassigned" },
            { label: "Blocked", path: "/dashboard/contacts?filter=blocked", filterValue: "blocked" },
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
      label: "Settings",
      path: "/dashboard/settings",
      icon: <Settings size={20} />,
      adminOnly: false,
    },
  ];

  // Filter items based on user's role
  const menuItems = allMenuItems.filter((item) => !item.adminOnly || isAdmin);

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
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              isPending 
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : isAdmin 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                : "bg-blue-50 text-blue-700 border border-blue-100"
              }`}>
              {isPending ? "Pending Review" : isAdmin ? "Full Access" : "Agent View"}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const locked = item.restrictedForPending && isPending;
            
            if (locked) {
              return (
                <div
                  key={item.path}
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-400 cursor-not-allowed opacity-65 bg-slate-50/50"
                  title="Under review: Unlocks after approval"
                >
                  <div className="flex items-center gap-3.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              );
            }

            if (item.hasDropdown) {
              const isOpen = item.label === "Inbox" ? inboxOpen : contactsOpen;
              const isParentActive = location.pathname.startsWith(item.path);
              const defaultSubPath = item.dropdownItems[0].path;

              return (
                <div key={item.path} className="space-y-1">
                  <NavLink
                    to={defaultSubPath}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${isParentActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold"
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
                      className="p-1 hover:bg-emerald-100 hover:text-emerald-800 rounded-md transition"
                    >
                      {isOpen ? (
                        <ChevronUp size={14} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                    </span>
                  </NavLink>

                  {isOpen && (
                    <div className="pl-6 space-y-1 ml-3 border-l border-slate-100 animate-in fade-in duration-200">
                      {item.dropdownItems.map((subItem) => {
                        const isActive = isSubItemActive(item.path, subItem.filterValue);
                        return (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition duration-150 ${isActive
                              ? "bg-slate-50 text-emerald-700 font-semibold border-l-2 border-emerald-600 pl-3.5"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 pl-3.5"
                            }`}
                          >
                            <span>{subItem.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${isActive
                    ? "bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 font-semibold"
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

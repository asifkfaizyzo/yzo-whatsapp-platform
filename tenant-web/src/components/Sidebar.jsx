// src/components/Sidebar.jsx

import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Megaphone,
  FileCode,
  Users,
  UserCheck,
  BarChart3,
  Settings,
} from "lucide-react";

export default function Sidebar({ userRole, tenantStatus = "APPROVED" }) {
  const isAdmin = userRole === "admin";
  const isPending = tenantStatus === "PENDING";

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
          yzo Platform v1.0.0
        </p>
      </div>
    </aside>
  );
}

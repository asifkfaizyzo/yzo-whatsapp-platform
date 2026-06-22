// admin-web/src/components/Sidebar.jsx

import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  UserCheck,
  Settings,
} from "lucide-react";

export default function Sidebar({ userRole = "Super Admin" }) {
  const menuItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
      end: true,
    },
    {
      label: "Tenants",
      path: "/dashboard/tenants",
      icon: <Building2 size={20} />,
    },
    {
      label: "Platform Reports",
      path: "/dashboard/reports",
      icon: <BarChart3 size={20} />,
    },
    {
      label: "Admins Team",
      path: "/dashboard/team",
      icon: <UserCheck size={20} />,
    },
    {
      label: "System Settings",
      path: "/dashboard/settings",
      icon: <Settings size={20} />,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[color:var(--border)] flex flex-col justify-between min-h-[calc(100vh-64px)] shrink-0">
      <div className="flex flex-col py-6 px-4">
        {/* User Role Indicator Card */}
        <div className="mb-6 rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-xs text-slate-400 font-medium">Active Role</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-semibold capitalize text-slate-800">
              {userRole}
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              Full Access
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => (
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
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[color:var(--border)]">
        <p className="text-[11px] text-slate-400 text-center font-medium">
          sudoreply v1.0.0
        </p>
      </div>
    </aside>
  );
}
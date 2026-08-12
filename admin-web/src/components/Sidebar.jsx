// admin-web/src/components/Sidebar.jsx

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  UserCheck,
  CreditCard,
  Settings,
  BadgeIndianRupee,
  TicketCheck,
  HelpCircle,
  Sparkles,
  Shield,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

export default function Sidebar({ userRole = "Super Admin" }) {
  const location = useLocation();

  // Collapse/Expand state persisted in localStorage
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem("admin_sidebar_collapsed") === "true";
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
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const menuItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
      end: true,
      category: "main",
    },
    {
      label: "Tenants",
      path: "/dashboard/tenants",
      icon: <Building2 size={20} />,
      category: "main",
    },
    {
      label: "Subscription Plans",
      path: "/dashboard/subscription-plans",
      icon: <CreditCard size={20} />,
      category: "main",
    },
    {
      label: "Subscriptions",
      path: "/dashboard/subscriptions",
      icon: <Sparkles size={20} />,
      category: "main",
    },
    {
      label: "Revenue",
      path: "/dashboard/revenue",
      icon: <BadgeIndianRupee size={20} />,
      category: "main",
    },
    {
      label: "Support Tickets",
      path: "/dashboard/tickets",
      icon: <TicketCheck size={20} />,
      category: "main",
    },
    {
      label: "Marketing Enquiries",
      path: "/dashboard/enquiries",
      icon: <HelpCircle size={20} />,
      category: "main",
    },
    {
      label: "Enterprise Leads",
      path: "/dashboard/enterprise-leads",
      icon: <Sparkles size={20} />,
      category: "main",
    },
    {
      label: "Platform Reports",
      path: "/dashboard/reports",
      icon: <BarChart3 size={20} />,
      category: "other",
    },
    {
      label: "Audit Logs",
      path: "/dashboard/audit-logs",
      icon: <Shield size={20} />,
      category: "other",
    },
    {
      label: "System Settings",
      path: "/dashboard/settings",
      icon: <Settings size={20} />,
      category: "other",
    },
  ];

  const mainMenu = menuItems.filter((item) => item.category === "main");
  const otherMenu = menuItems.filter((item) => item.category === "other");

  const renderMenuItem = (item) => (
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
      <span className={`transition-all duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden absolute" : "opacity-100"}`}>
        {item.label}
      </span>
      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="sidebar-tooltip pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
          {item.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
        </div>
      )}
    </NavLink>
  );

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
                  {userRole}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-50 text-[#125EF2] border-blue-200">
                  Full Access
                </span>
              </div>
            </div>
          ) : (
            /* Collapsed: show just a small avatar circle */
            <div className="hidden md:flex justify-center mb-3">
              <div className="group relative w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold uppercase">
                {(userRole || "A").charAt(0)}
                {/* Tooltip */}
                <div className="sidebar-tooltip pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 z-50 shadow-lg">
                  {userRole} — Full Access
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
                <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-[0.5px] px-4 pt-1 pb-2">System</p>
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
// src/components/TopNavBar.jsx

import React, { useState, useEffect, useRef } from "react";
import { Bell, User, LogOut, ChevronDown, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth.service";

export default function TopNavBar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between bg-white border-b border-[color:var(--border)] px-6 py-3 h-16 relative z-30 shrink-0">
      {/* Left: Brand Logo */}
      <div className="flex items-center gap-2">
        <div className="bg-[#10b981] p-2 rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.07-1.38C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-gray-800 tracking-tight">
          {user?.tenantName || user?.companyName || "Replyo"}
        </span>
      </div>

      {/* Middle: WhatsApp API Connection Status */}
      <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3.5 py-1.5">
        <CheckCircle2 size={15} className="text-emerald-600 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-800">
          WhatsApp Cloud API: Connected
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button className="text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-50 transition relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>
        </button>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition duration-150"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm border border-emerald-200">
              {user?.name ? user.name.charAt(0).toUpperCase() : (user?.tenantName ? user.tenantName.charAt(0).toUpperCase() : <User size={16} />)}
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
              className={`text-slate-500 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""
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

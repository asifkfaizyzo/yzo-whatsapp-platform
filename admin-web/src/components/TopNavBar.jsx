import React, { useState, useEffect, useRef } from "react";
import { Bell, Rocket, User, LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logoutSuperAdmin } from "../lib/authApi";

const TopNavbar = () => {
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
    const result = await logoutSuperAdmin();
    // Even if logout fails, we clear state and navigate back to login
    navigate("/login");
  };

  return (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3 h-16 relative z-30">
      {/* Left: Logo */}
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
          yzo <span className="text-[#10b981] font-semibold">platform</span>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-5">
        {/* Quick Start Status */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-gray-600 text-sm font-medium">Quick start</span>
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="w-8 h-8 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="13"
                stroke="#e2e8f0"
                strokeWidth="2.5"
                fill="none"
              />
              <circle
                cx="16"
                cy="16"
                r="13"
                stroke="#10b981"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="81.68"
                strokeDashoffset="40.84"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#059669]">
              2/4
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button className="hidden md:inline-flex border border-[#10b981] text-[#059669] px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 transition duration-150">
          Book a demo
        </button>

        {/* Notification Bell */}
        <button className="text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-50 transition">
          <Bell size={20} />
        </button>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition duration-150"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-gray-150 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Signed in as</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{user?.name || "Super Admin"}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email || "admin@company.com"}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors duration-150 font-medium"
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
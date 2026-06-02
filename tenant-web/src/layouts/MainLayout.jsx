// src/layouts/MainLayout.jsx

import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState("agent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

    if (!token || token === "undefined") {
      navigate("/login");
      return;
    }

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const role = parsed.type === "TENANT" ? "admin" : "agent";
        setUserRole(role);

        // Role-based Route Protection
        // If an agent tries to access admin-only pages, redirect them to Inbox
        const adminOnlyPaths = [
          "/dashboard/broadcasts",
          "/dashboard/templates",
          "/dashboard/team",
          "/dashboard/reports"
        ];

        // Prefix matching for admin-only pages
        const isAdminPath = adminOnlyPaths.some(path => {
          return location.pathname.startsWith(path);
        });

        if (role !== "admin" && isAdminPath) {
          console.warn("Unauthorized access: Redirecting agent to Inbox console.");
          navigate("/dashboard/inbox");
        }
      } catch (e) {
        console.error("Failed to parse user role:", e);
      }
    }
    setLoading(false);
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <TopNavBar />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar userRole={userRole} />

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-64px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// src/layouts/MainLayout.jsx

import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";
import api from "../lib/axios";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tenantStatus, setTenantStatus] = useState("APPROVED");
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

        // ── ADDED: Check Tenant Status & Enforce Dashboard-Only ──
        const status = parsed.status || "APPROVED";
        setTenantStatus(status);

        // Fetch fresh tenant status from database to sync
        if (parsed.type === "TENANT") {
          api.get("/me")
            .then(res => {
              if (res.data?.success && res.data?.data) {
                const freshTenant = res.data.data;
                
                // If tenant status became BLOCKED or de-activated, force logout immediately
                if (freshTenant.status === "BLOCKED" || !freshTenant.isActive) {
                  console.warn("Tenant account is blocked or inactive. Logging out.");
                  localStorage.clear();
                  navigate("/login");
                  return;
                }

                if (freshTenant.status !== parsed.status) {
                  // Status updated! Sync with localStorage and state
                  const updatedUser = { ...parsed, status: freshTenant.status };
                  localStorage.setItem("user", JSON.stringify(updatedUser));
                  setTenantStatus(freshTenant.status);
                }
              }
            })
            .catch(err => {
              console.error("Failed to sync tenant status:", err);
              // Handle blocked/unauthorized status
              if (err.response?.status === 403 || err.response?.status === 401) {
                console.warn("Unauthorized access or blocked account. Logging out.");
                localStorage.clear();
                navigate("/login");
              }
            });
        }
        
        if (status === "PENDING") {
          const allowedPendingPaths = ["/dashboard", "/dashboard/settings"];
          const isAllowed = allowedPendingPaths.some(path => 
            location.pathname === path || location.pathname === path + "/"
          );
          if (!isAllowed) {
            console.warn("Restricted account: Redirecting to Dashboard.");
            navigate("/dashboard");
            return;
          }
        }

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
        <Sidebar userRole={userRole} tenantStatus={tenantStatus} />

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-64px)]">
           <Outlet context={{ tenantStatus }} />
        </main>
      </div>
    </div>
  );
}

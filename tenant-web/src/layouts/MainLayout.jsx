// src/layouts/MainLayout.jsx

import React, { useEffect, useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";
import api from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuthStore();
  const [tenantStatus, setTenantStatus] = useState("APPROVED");
  const [userRole, setUserRole] = useState("agent");
  const [loading, setLoading] = useState(true);
  const fetchedMeRef = useRef(false);

  useEffect(() => {
    if (!accessToken || !user) {
      navigate("/login");
      return;
    }

    try {
      const role = user.type === "TENANT" ? "admin" : "agent";
      setUserRole(role);

      // ── ADDED: Check Tenant Status & Enforce Dashboard-Only ──
      const status = user.status || "APPROVED";
      setTenantStatus(status);

      // Fetch fresh tenant status from database to sync
      if (user.type === "TENANT" && !fetchedMeRef.current) {
        fetchedMeRef.current = true;
        api.get("/me")
          .then(res => {
            if (res.data?.success && res.data?.data) {
              const freshTenant = res.data.data;

              // If tenant status became BLOCKED or de-activated, force logout immediately
              if (freshTenant.status === "BLOCKED" || !freshTenant.isActive) {
                console.warn("Tenant account is blocked or inactive. Logging out.");
                useAuthStore.getState().logout();
                navigate("/login");
                return;
              }

              if (freshTenant.status !== user.status) {
                // Status updated! Sync with state
                useAuthStore.setState((state) => ({
                  user: { ...state.user, status: freshTenant.status }
                }));
                setTenantStatus(freshTenant.status);
              }
            }
          })
          .catch(err => {
            console.error("Failed to sync tenant status:", err);
            // Handle blocked/unauthorized status
            if (err.response?.status === 403 || err.response?.status === 401) {
              console.warn("Unauthorized access or blocked account. Logging out.");
              useAuthStore.getState().logout();
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
    setLoading(false);
  }, [navigate, location.pathname, accessToken, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#CFE0FD] border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f8fafc] overflow-hidden">
      {/* Sidebar (fixed full-height) + Spacer */}
      <Sidebar userRole={userRole} tenantStatus={tenantStatus} />

      {/* Right side: Header + Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
        {/* Header */}
        <TopNavBar />

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet context={{ tenantStatus }} />
        </main>
      </div>
    </div>
  );
}

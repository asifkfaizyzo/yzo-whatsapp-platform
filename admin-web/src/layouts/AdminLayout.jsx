import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/useAdminAuthStore";
import Sidebar from "../components/Sidebar";
import TopNavbar from "../components/TopNavBar";

export default function AdminLayout() {
  const { isAuthenticated, isLoading, user } = useAdminAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10b981]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.type === "SUPERADMIN" ? "Super Admin" : (user?.name || "Admin");

  return (
    <div className="min-h-screen flex bg-[#f8fafc] overflow-hidden">
      {/* Sidebar (fixed full-height) + Spacer */}
      <Sidebar userRole={userRole} />

      {/* Right side: Header + Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
        {/* Top Navigation Bar */}
        <TopNavbar />

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
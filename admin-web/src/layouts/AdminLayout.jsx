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
    <div className="min-h-screen flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Top Navigation Bar */}
      <TopNavbar />
      
      {/* Main Content Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar userRole={userRole} />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-64px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
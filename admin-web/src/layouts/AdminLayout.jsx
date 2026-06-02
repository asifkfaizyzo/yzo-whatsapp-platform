import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopNavbar from "../components/TopNavBar";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState("Super Admin");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token || token === "undefined") {
      navigate("/login");
      return;
    }

    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.type === "SUPERADMIN") {
          setUserRole("Super Admin");
        } else if (parsed.name) {
          setUserRole(parsed.name);
        }
      }
    } catch (e) {
      console.error("Failed to parse user role in AdminLayout", e);
    }
  }, [navigate]);

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

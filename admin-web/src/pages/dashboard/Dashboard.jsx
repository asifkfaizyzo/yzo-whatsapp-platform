// admin-web/src/pages/dashboard/Dashboard.jsx

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users2,
  Activity,
  DollarSign,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  Globe,
  TrendingUp,
  Settings,
  Server,
  Shield,
  ArrowRight,
  RefreshCw,
  Cpu
} from "lucide-react";
import api from "../../lib/axios";
import { useAdminAuthStore } from "../../store/useAdminAuthStore";

export default function Dashboard() {
  const user = useAdminAuthStore((state) => state.user);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch tenants to calculate real stats
  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/get-all-tenants");
      if (response.data?.success && response.data?.data?.tenants) {
        setTenants(response.data.data.tenants);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("Failed to fetch platform metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Aggregated Stats
  const totalTenantsCount = tenants.length;
  const activeTenantsCount = tenants.filter((t) => t.status === "APPROVED" && t.isActive).length;
  const pendingTenantsCount = tenants.filter((t) => t.status === "PENDING").length;
  const blockedTenantsCount = tenants.filter((t) => t.status === "BLOCKED").length;

  // Generate activities from real tenants
  const recentActivities = tenants
    .slice(0, 5)
    .map((tenant) => {
      let actionText = `Tenant "${tenant.tenantName}" registered`;
      let timeText = new Date(tenant.createdAt).toLocaleDateString();
      let colorClass = "bg-blue-500";

      if (tenant.status === "PENDING") {
        actionText = `Tenant "${tenant.tenantName}" registered & is pending approval`;
        colorClass = "bg-amber-500";
      } else if (tenant.status === "BLOCKED") {
        actionText = `Tenant "${tenant.tenantName}" was blocked`;
        colorClass = "bg-rose-500";
      } else if (tenant.status === "APPROVED" && !tenant.isActive) {
        actionText = `Tenant "${tenant.tenantName}" was suspended`;
        colorClass = "bg-slate-400";
      } else if (tenant.status === "APPROVED" && tenant.isActive) {
        actionText = `Tenant "${tenant.tenantName}" is approved and active`;
        colorClass = "bg-[#125EF2]";
      }

      return {
        id: tenant.id,
        text: actionText,
        time: timeText,
        color: colorClass,
      };
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back, {user?.name || "Super Admin"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor platform system load, control tenant nodes, and handle onboarding approvals.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="btn-secondary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition duration-150 self-start md:self-auto"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span>Sync Dashboard</span>
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stat 1: Total Tenants */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Tenants</p>
            {loading ? (
              <div className="h-9 w-12 bg-slate-100 animate-pulse rounded-lg mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">{totalTenantsCount}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-[#125EF2] font-medium">
              <TrendingUp size={14} />
              <span>SaaS instances registered</span>
            </div>
          </div>
          <div className="p-3 bg-[#EAF2FE] rounded-2xl text-[#125EF2]">
            <Building2 size={24} />
          </div>
        </div>

        {/* Stat 2: Active Tenants */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Instances</p>
            {loading ? (
              <div className="h-9 w-12 bg-slate-100 animate-pulse rounded-lg mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">{activeTenantsCount}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
              <span>
                {totalTenantsCount ? Math.round((activeTenantsCount / totalTenantsCount) * 100) : 0}% active rate
              </span>
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
            <Users2 size={24} />
          </div>
        </div>

        {/* Stat 3: Pending Approvals */}
        <div className="card p-6 flex items-start justify-between relative overflow-hidden">
          <div className="space-y-2 z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pending Approvals</p>
            {loading ? (
              <div className="h-9 w-12 bg-slate-100 animate-pulse rounded-lg mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">{pendingTenantsCount}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              {pendingTenantsCount > 0 ? (
                <>
                  <AlertCircle size={14} className="animate-bounce" />
                  <span>Requires immediate review</span>
                </>
              ) : (
                <span>All caught up!</span>
              )}
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 z-10">
            <Activity size={24} />
          </div>
        </div>

        {/* Stat 4: Platform Health */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Platform Health</p>
            <p className="text-3xl font-bold text-gray-900">99.98%</p>
            <div className="flex items-center gap-1 text-xs text-[#125EF2] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#125EF2] animate-ping"></span>
              <span>All nodes online</span>
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
            <Globe size={24} />
          </div>
        </div>
      </div>

      {/* ── Info & Logs Dashboard Section ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Recent Activity Logs */}
        <div className="card p-6 lg:col-span-2 space-y-5 bg-white">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-800 text-base">Recent Platform Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Real-time tenant onboarding and instance statuses</p>
            </div>
            <Link to="/dashboard/tenants" className="text-xs font-semibold text-[#125EF2] hover:underline flex items-center gap-1">
              <span>View All Tenants</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-8 h-8 text-[#125EF2] animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-400">Loading audit log...</p>
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-500">No activity yet</p>
              <p className="text-xs text-gray-400 mt-1">Tenant accounts will show up here as they register.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3.5 flex items-start gap-3">
                  <span className={`h-2.5 w-2.5 mt-1.5 rounded-full ${act.color} flex-shrink-0`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{act.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Date: {act.time} • System Onboard</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Gateway Status & Quick Navigation */}
        <div className="space-y-6">
          {/* Quick Guide Card */}
          <div className="card p-6 space-y-4 bg-gradient-to-br from-[#125EF2] to-[#125EF2] text-white border-transparent shadow-md">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Shield size={18} />
              <span>Super Admin Access</span>
            </h3>
            <p className="text-sm text-[#CFE0FD] leading-relaxed">
              You are logged in with root platform privileges. Use the links below or the sidebar to review business analytics, register manual nodes, or toggle security configurations.
            </p>
            <div className="bg-[#125EF2]/50 rounded-2xl p-4 border border-[#125EF2]/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#CFE0FD]">System Gateway API</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold">12ms</p>
                <p className="text-xs text-[#CFE0FD]">avg webhook delay</p>
              </div>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="card p-5 space-y-3 bg-white">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SaaS Quick Tasks</h4>
            <div className="space-y-2">
              <Link
                to="/dashboard/tenants"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 hover:text-[#0F4FCC] hover:bg-[#EAF2FE]/50 transition font-semibold text-xs"
              >
                <span className="flex items-center gap-2">
                  <Building2 size={15} />
                  <span>Onboard & Approve Tenants</span>
                </span>
                <ArrowRight size={14} />
              </Link>

              <Link
                to="/dashboard/reports"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 hover:text-[#0F4FCC] hover:bg-[#EAF2FE]/50 transition font-semibold text-xs"
              >
                <span className="flex items-center gap-2">
                  <Server size={15} />
                  <span>View System Reports</span>
                </span>
                <ArrowRight size={14} />
              </Link>

              <Link
                to="/dashboard/settings"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 hover:text-[#0F4FCC] hover:bg-[#EAF2FE]/50 transition font-semibold text-xs"
              >
                <span className="flex items-center gap-2">
                  <Settings size={15} />
                  <span>System Control Settings</span>
                </span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

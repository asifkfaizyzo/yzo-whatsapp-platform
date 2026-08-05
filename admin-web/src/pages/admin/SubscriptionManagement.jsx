import React, { useEffect, useState } from "react";
import {
  Search,
  Settings2,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Calendar,
  SlidersHorizontal,
} from "lucide-react";
import api from "../../lib/axios";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

export default function SubscriptionManagement() {
  const confirm = useConfirm();
  const toast = useToast();

  const [tenants, setTenants] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Summary counts for dashboard header
  const [summaryStats, setSummaryStats] = useState({
    active: 0,
    cancelling: 0,
    expired: 0,
    paused: 0,
  });

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/admin/subscriptions?page=${page}&limit=10&search=${encodeURIComponent(
          search
        )}&status=${statusFilter}&plan=${planFilter}`
      );
      if (res.data.success) {
        const fetchedTenants = res.data.data.tenants || [];
        setTenants(fetchedTenants);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalCount(res.data.data.total || 0);

        // Compute summary counts from response if on first load or update
        const stats = { active: 0, cancelling: 0, expired: 0, paused: 0 };
        fetchedTenants.forEach((t) => {
          const st = (t.subscriptionStatus || "").toLowerCase();
          if (st === "active") stats.active++;
          else if (st === "cancel_at_period_end" || st === "cancelling")
            stats.cancelling++;
          else if (st === "expired") stats.expired++;
          else if (st === "paused") stats.paused++;
        });
        setSummaryStats(stats);
      }
    } catch (err) {
      toast.error("Failed to fetch subscription records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [page, statusFilter, planFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTenants();
  };

  const handleAction = async (tenantId, action, extendDays = null) => {
    setActiveDropdown(null);
    if (action === "expire") {
      const ok = await confirm({
        type: "danger",
        title: "Force Expire Subscription?",
        message:
          "This tenant will lose premium access immediately and revert to restricted status.",
        confirmLabel: "Force Expire Access",
      });
      if (!ok) return;
    }

    try {
      const payload = { action };
      if (extendDays) payload.extendDays = extendDays;

      const res = await api.patch(`/admin/subscriptions/${tenantId}`, payload);
      if (res.data.success) {
        toast.success(`Subscription action "${action}" completed successfully.`);
        fetchTenants();
      } else {
        toast.error(res.data.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "An error occurred.");
    }
  };

  const getPlanBadge = (planName) => {
    const p = (planName || "Starter").toLowerCase();
    if (p.includes("enterprise") || p.includes("custom")) {
      return "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20";
    }
    if (p.includes("pro") || p.includes("business") || p.includes("growth")) {
      return "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm shadow-blue-500/20";
    }
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  const getStatusBadge = (status) => {
    const st = (status || "active").toLowerCase();
    switch (st) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case "cancel_at_period_end":
      case "cancelling":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
            <Clock size={12} className="text-amber-500" />
            Cancelling
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
            <XCircle size={12} className="text-rose-500" />
            Expired
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <PauseCircle size={12} className="text-slate-500" />
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      {/* Invisible Fullscreen Backdrop to close dropdown on click outside */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-20 bg-transparent"
          onClick={() => setActiveDropdown(null)}
        />
      )}

      {/* Header Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
            <CreditCard size={16} />
            <span>SaaS Billing & License Hub</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Active Tenant Subscriptions
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Real-time control center to monitor tenant subscription health, handle manual period extensions, pause access, or override plan tiers.
          </p>
        </div>

        <button
          onClick={fetchTenants}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition shadow-sm self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Sync Subscriptions</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Active Licenses</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-3">
              {summaryStats.active}
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-3 flex items-center gap-1">
            <span>Healthy recurring tenants</span>
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Pending Cancellation</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <Clock size={18} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-3">
              {summaryStats.cancelling}
            </div>
          </div>
          <p className="text-[11px] text-amber-600 font-medium mt-3">
            Cancelling at period end
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Expired / Lapsed</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <XCircle size={18} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-3">
              {summaryStats.expired}
            </div>
          </div>
          <p className="text-[11px] text-rose-500 font-medium mt-3">
            Payment or trial ended
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Paused Accounts</span>
              <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                <PauseCircle size={18} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-3">
              {summaryStats.paused}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-3">
            Manually suspended
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 justify-between items-center shadow-sm">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="Search tenant name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-200 pl-10 pr-10 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition bg-slate-50/50 focus:bg-white"
          />
          <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
                fetchTenants();
              }}
              className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mr-2">
            <SlidersHorizontal size={14} />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none bg-white text-slate-700 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="cancel_at_period_end">Cancelling</option>
            <option value="expired">Expired</option>
            <option value="paused">Paused</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none bg-white text-slate-700 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="">All Plan Tiers</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional / Pro</option>
            <option value="business">Business / Enterprise</option>
          </select>
        </div>
      </div>

      {/* Main Subscriptions Data Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm min-h-[380px] flex flex-col justify-between">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="animate-spin text-indigo-600" size={32} />
            <p className="text-xs text-slate-500 font-medium">
              Loading tenant subscription status...
            </p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CreditCard size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">
              No Subscriptions Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No tenant subscriptions match your search parameters or filter options.
            </p>
          </div>
        ) : (
          <div className="overflow-x-visible pb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Tenant Organization</th>
                  <th className="py-4 px-6">Active Plan</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Renewal / Expiry Date</th>
                  <th className="py-4 px-6 text-right">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {tenants.map((tenant, index) => {
                  const companyName = tenant.tenantName || "Unnamed Tenant";
                  const initial = companyName.charAt(0).toUpperCase();
                  const isLastRows = index >= tenants.length - 2 && tenants.length > 2;

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/60 transition group relative"
                    >
                      {/* Company Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 text-indigo-700 font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs group-hover:text-indigo-600 transition flex items-center gap-1.5">
                              <span>{companyName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {tenant.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan Tier */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize ${getPlanBadge(
                            tenant.currentPlan
                          )}`}
                        >
                          {tenant.currentPlan || "Starter"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {getStatusBadge(tenant.subscriptionStatus)}
                      </td>

                      {/* Period End */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                          <Calendar size={13} className="text-slate-400" />
                          <span>
                            {tenant.planPeriodEnd
                              ? new Date(
                                  tenant.planPeriodEnd
                                ).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "No end date set"}
                          </span>
                        </div>
                        {tenant.cancellationReason && (
                          <p className="text-[10px] text-rose-500 mt-0.5 truncate max-w-xs">
                            Reason: {tenant.cancellationReason}
                          </p>
                        )}
                      </td>

                      {/* Action Dropdown */}
                      <td className="py-4 px-6 text-right relative">
                        <button
                          onClick={() =>
                            setActiveDropdown(
                              activeDropdown === tenant.id ? null : tenant.id
                            )
                          }
                          className={`p-2 rounded-xl transition ${
                            activeDropdown === tenant.id
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          }`}
                          title="Actions"
                        >
                          <Settings2 size={16} />
                        </button>

                        {activeDropdown === tenant.id && (
                          <div
                            className={`absolute right-6 z-30 w-52 rounded-2xl bg-white border border-slate-200 shadow-2xl py-2 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-150 ${
                              isLastRows ? "bottom-12" : "top-12"
                            }`}
                          >
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Manage License
                            </div>

                            <div className="py-1">
                              {tenant.subscriptionStatus !== "paused" ? (
                                <button
                                  onClick={() =>
                                    handleAction(tenant.id, "pause")
                                  }
                                  className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                                >
                                  <PauseCircle size={14} className="text-amber-500" />
                                  <span>Pause Account</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleAction(tenant.id, "reactivate")
                                  }
                                  className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                                >
                                  <CheckCircle2 size={14} className="text-emerald-500" />
                                  <span>Reactivate Account</span>
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  handleAction(tenant.id, "extend", 30)
                                }
                                className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                              >
                                <Clock size={14} className="text-indigo-500" />
                                <span>Extend +30 Days</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() =>
                                  handleAction(tenant.id, "expire")
                                }
                                className="w-full px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                              >
                                <ShieldAlert size={14} />
                                <span>Force Expire Access</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-b-2xl">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40 transition shadow-xs"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span className="text-xs font-semibold text-slate-500">
              Page {page} of {totalPages} ({totalCount} Tenants)
            </span>

            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40 transition shadow-xs"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
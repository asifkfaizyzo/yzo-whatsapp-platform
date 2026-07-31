// admin-web/src/pages/dashboard/AuditLogs.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Search,
  Download,
  RefreshCw,
  LogIn,
  LogOut,
  UserX,
  UserCheck,
  Building2,
  Ban,
  Unlock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Monitor,
  Globe,
  Filter,
  X,
} from "lucide-react";
import api from "../../lib/axios";

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────

const ACTION_COLORS = {
  LOGIN:                    "bg-emerald-100 text-emerald-700",
  LOGOUT:                   "bg-slate-100  text-slate-600",
  LOGIN_FAILED:             "bg-rose-100   text-rose-700",
  TENANT_APPROVED:          "bg-blue-100   text-blue-700",
  TENANT_BLOCKED:           "bg-rose-100   text-rose-700",
  TENANT_UNBLOCKED:         "bg-emerald-100 text-emerald-700",
  TENANT_DELETED:           "bg-red-100    text-red-800",
  TENANT_DEACTIVATED:       "bg-amber-100  text-amber-700",
  TENANT_REACTIVATED:       "bg-emerald-100 text-emerald-700",
  TENANT_CREATED:           "bg-blue-100   text-blue-700",
  TENANT_UPDATED:           "bg-violet-100 text-violet-700",
  USER_DEACTIVATED:         "bg-amber-100  text-amber-700",
  USER_REACTIVATED:         "bg-emerald-100 text-emerald-700",
  PAYMENT_SUCCESS:          "bg-emerald-100 text-emerald-700",
  PAYMENT_FAILED:           "bg-rose-100   text-rose-700",
  PASSWORD_RESET_REQUESTED: "bg-amber-100  text-amber-700",
  PASSWORD_RESET_COMPLETED: "bg-emerald-100 text-emerald-700",
  SYSTEM_CLEANUP:           "bg-slate-100  text-slate-600",
};

const ACTION_ICONS = {
  LOGIN:              <LogIn   size={12} />,
  LOGOUT:             <LogOut  size={12} />,
  LOGIN_FAILED:       <Ban     size={12} />,
  TENANT_APPROVED:    <Building2 size={12} />,
  TENANT_BLOCKED:     <Ban     size={12} />,
  TENANT_UNBLOCKED:   <Unlock  size={12} />,
  TENANT_DELETED:     <Trash2  size={12} />,
  TENANT_DEACTIVATED: <UserX   size={12} />,
  TENANT_REACTIVATED: <UserCheck size={12} />,
  USER_DEACTIVATED:   <UserX   size={12} />,
  USER_REACTIVATED:   <UserCheck size={12} />,
};

const MODULES = [
  "ALL", "AUTH", "TENANT", "USER",
  "BILLING", "TICKET", "SYSTEM",
];

const ACTIONS = [
  "ALL",
  "LOGIN", "LOGOUT", "LOGIN_FAILED",
  "TENANT_APPROVED", "TENANT_BLOCKED", "TENANT_UNBLOCKED",
  "TENANT_DEACTIVATED", "TENANT_REACTIVATED", "TENANT_DELETED",
  "USER_DEACTIVATED", "USER_REACTIVATED",
  "PAYMENT_SUCCESS", "PAYMENT_FAILED",
  "PASSWORD_RESET_REQUESTED",
];

const ACTOR_TYPES = ["ALL", "SUPER_ADMIN", "TENANT", "USER", "SYSTEM"];

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────

export default function AuditLogs() {
  // ── State ──
  const [logs,       setLogs]       = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [pagination, setPagination] = useState({
    total: 0, page: 1, limit: 20, totalPages: 1,
  });

  // ── Filters ──
  const [search,    setSearch]    = useState("");
  const [module,    setModule]    = useState("ALL");
  const [action,    setAction]    = useState("ALL");
  const [actorType, setActorType] = useState("ALL");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [page,      setPage]      = useState(1);

  // ── Fetch Stats ──
  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try {
      const res = await api.get("/superadmin/audit-logs/stats");
      if (res.data?.success) setStats(res.data.data);
    } catch (err) {
      console.error("Stats fetch error:", err);
    } finally {
      setStatsLoad(false);
    }
  }, []);

  // ── Fetch Logs ──
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search              ) params.search    = search;
      if (module    !== "ALL" ) params.module    = module;
      if (action    !== "ALL" ) params.action    = action;
      if (actorType !== "ALL" ) params.actorType = actorType;
      if (dateFrom            ) params.dateFrom  = dateFrom;
      if (dateTo              ) params.dateTo    = dateTo;

      const res = await api.get("/superadmin/audit-logs", { params });
      if (res.data?.success) {
        setLogs(res.data.data.logs);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error("Logs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, module, action, actorType, dateFrom, dateTo]);

  // ── Effects ──
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLogs();  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, module, action, actorType, dateFrom, dateTo]);

  // ── Clear All Filters ──
  const clearFilters = () => {
    setSearch("");
    setModule("ALL");
    setAction("ALL");
    setActorType("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    search || module !== "ALL" || action !== "ALL" ||
    actorType !== "ALL" || dateFrom || dateTo;

  // ── Export CSV ──
  const exportCSV = () => {
    if (logs.length === 0) return;

    const headers = [
      "ID", "Actor Name", "Actor Email", "Actor Type",
      "Action", "Module", "Description",
      "Target", "IP Address", "Browser", "Date",
    ];

    const rows = logs.map((l) => [
      l.id,
      l.actorName,
      l.actorEmail,
      l.actorType,
      l.action,
      l.module,
      `"${l.description}"`,       // wrap in quotes (may have commas)
      l.targetName  || "-",
      l.ipAddress   || "-",
      l.userAgent   ? `"${l.userAgent}"` : "-",
      new Date(l.createdAt).toLocaleString("en-IN"),
    ]);

    const csv  = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Format Date ──
  const fmtDate = (d) =>
    new Date(d).toLocaleString("en-IN", {
      day:    "2-digit",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });

  // ── Actor Type Badge ──
  const actorBadge = (type) => {
    const map = {
      SUPER_ADMIN: "bg-violet-100 text-violet-700",
      TENANT:      "bg-blue-100   text-blue-700",
      USER:        "bg-slate-100  text-slate-600",
      SYSTEM:      "bg-gray-100   text-gray-500",
    };
    return map[type] || "bg-gray-100 text-gray-500";
  };

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-[#125EF2]" />
            Audit Logs
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Complete history of all platform actions. Retained for 90 days.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { fetchLogs(); fetchStats(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl
                       border border-slate-200 text-sm font-medium
                       text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                       bg-[#125EF2] text-white text-sm font-semibold
                       hover:bg-[#0F4FCC] transition
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Events",
            value: stats?.total ?? "-",
            color: "text-gray-800",
            bg:    "bg-white",
          },
          {
            label: "Last 24 Hours",
            value: stats?.last24hCount ?? "-",
            color: "text-[#125EF2]",
            bg:    "bg-white",
          },
          {
            label: "Last 7 Days",
            value: stats?.last7daysCount ?? "-",
            color: "text-violet-600",
            bg:    "bg-white",
          },
          {
            label: "Failed Logins (24h)",
            value: stats?.failedLogins24h ?? "-",
            color: stats?.failedLogins24h > 0 ? "text-rose-600" : "text-gray-500",
            bg:    stats?.failedLogins24h > 0 ? "bg-rose-50" : "bg-white",
          },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            {statsLoad ? (
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded mt-1" />
            ) : (
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card p-4 space-y-4">

        {/* Filter Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Filter size={14} />
            Filters
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-rose-500 hover:underline
                         font-medium flex items-center gap-1"
            >
              <X size={12} />
              Clear all
            </button>
          )}
        </div>

        {/* Filter Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search actor, email, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200
                         rounded-xl focus:outline-none
                         focus:ring-2 focus:ring-[#125EF2]/30"
            />
          </div>

          {/* Module */}
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="py-2 px-3 text-sm border border-slate-200
                       rounded-xl focus:outline-none
                       focus:ring-2 focus:ring-[#125EF2]/30"
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Action */}
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="py-2 px-3 text-sm border border-slate-200
                       rounded-xl focus:outline-none
                       focus:ring-2 focus:ring-[#125EF2]/30"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="py-2 px-3 text-sm border border-slate-200
                       rounded-xl focus:outline-none
                       focus:ring-2 focus:ring-[#125EF2]/30"
          />

          {/* Date To */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 text-sm border border-slate-200
                       rounded-xl focus:outline-none
                       focus:ring-2 focus:ring-[#125EF2]/30"
          />
        </div>

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {[
              search      && { label: `Search: ${search}`,     clear: () => setSearch("")        },
              module !== "ALL"    && { label: `Module: ${module}`,     clear: () => setModule("ALL")     },
              action !== "ALL"    && { label: `Action: ${action.replace(/_/g," ")}`, clear: () => setAction("ALL") },
              actorType !== "ALL" && { label: `Actor: ${actorType}`,   clear: () => setActorType("ALL")  },
              dateFrom    && { label: `From: ${dateFrom}`,     clear: () => setDateFrom("")      },
              dateTo      && { label: `To: ${dateTo}`,         clear: () => setDateTo("")        },
            ]
              .filter(Boolean)
              .map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1
                             bg-[#EAF2FE] text-[#125EF2] rounded-full font-medium"
                >
                  {tag.label}
                  <button
                    onClick={tag.clear}
                    className="ml-0.5 hover:text-rose-500 transition"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">

            {/* Head */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "Actor", "Action", "Module",
                  "Description", "Target",
                  "IP Address", "Time",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-400
                               uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-50">

              {/* Loading Skeleton */}
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 animate-pulse rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))

              /* Empty State */
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Shield size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      No audit logs found
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      {hasActiveFilters
                        ? "Try adjusting your filters"
                        : "Actions will appear here as they happen"}
                    </p>
                  </td>
                </tr>

              /* Logs */
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 transition"
                  >

                    {/* Actor */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 text-xs">
                        {log.actorName}
                      </div>
                      <div className="text-gray-400 text-[11px] mt-0.5">
                        {log.actorEmail}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5
                                   rounded-full mt-1 inline-block
                                   ${actorBadge(log.actorType)}`}
                      >
                        {log.actorType.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px]
                                   font-semibold px-2 py-1 rounded-full
                                   whitespace-nowrap
                                   ${ACTION_COLORS[log.action]
                                     || "bg-gray-100 text-gray-600"}`}
                      >
                        {ACTION_ICONS[log.action]}
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-500
                                       bg-slate-100 px-2 py-1 rounded-lg">
                        {log.module}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {log.description}
                      </p>
                    </td>

                    {/* Target */}
                    <td className="px-4 py-3">
                      {log.targetName ? (
                        <div>
                          <div className="text-xs font-medium text-gray-700">
                            {log.targetName}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {log.targetType}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* IP Address */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs
                                     font-mono text-gray-500">
                        <Globe size={11} className="text-gray-300" />
                        {log.ipAddress === "::1"
                          ? "localhost"
                          : log.ipAddress || "—"}
                      </div>
                      {log.userAgent && (
                        <div className="flex items-center gap-1 text-[10px]
                                       text-gray-300 mt-0.5">
                          <Monitor size={10} />
                          <span className="truncate max-w-[100px]">
                            {log.userAgent.split(" ")[0]}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs
                                     text-gray-400">
                        <Clock size={11} />
                        {fmtDate(log.createdAt)}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {pagination.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3
                       border-t border-slate-100 bg-slate-50/50"
          >
            <p className="text-xs text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-600">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              {" "}–{" "}
              <span className="font-semibold text-gray-600">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {" "}of{" "}
              <span className="font-semibold text-gray-600">
                {pagination.total}
              </span>{" "}
              events
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-lg border border-slate-200
                           disabled:opacity-40 hover:bg-white transition"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="text-xs font-semibold text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200
                           disabled:opacity-40 hover:bg-white transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
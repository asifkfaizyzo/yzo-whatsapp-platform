// admin-web/src/pages/Tenants/comps/TenantsTable.jsx (do not remove this comment)
import React from "react";
import {
  Search,
  X,
  RefreshCw,
  Building2,
  Users2,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Zap,
  PlusCircle,
  CreditCard,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ActionMenu from "./ActionMenu";
import {
  PlanBadge,
  SubscriptionStatusBadge,
  AccountStatusBadge,
} from "./TenantBadges";
import {
  getTenantInitials,
  getDaysRemaining,
  getRelativeTime,
  getSubscriptionStatus,
  getTenantAccountStatus,
  getPlanLabel,
} from "../tenant.constants";

export default function TenantsTable({
  tenants = [],
  loading = false,
  error = null,
  stats = {},
  totalTenants = 0,
  page = 1,
  pageSize = 10,
  totalPages = 1,
  searchQuery = "",
  setSearchQuery,
  statusFilter = "All",
  setStatusFilter,
  planFilter = "",
  setPlanFilter,
  subStatusFilter = "",
  setSubStatusFilter,
  plans = [],
  setPage,
  setPageSize,
  resetFilters,
  hasActiveFilters = false,
  onViewDetails,
  onEdit,
  onManageSubscription,
  onManualActivate,
  onManageTeam,
  onQuickExtend,
  onToggleSubPause,
  onForceExpireSub,
  onToggleActivation,
  onApproveStatus,
  onBlock,
  onUnblock,
  onDelete,
  onCreate,
  onRefresh,
}) {
  const tabs = [
    { id: "All", label: "All Tenants", count: stats.total ?? tenants.length },
    { id: "Active", label: "Active", count: stats.activeSub ?? 0 },
    { id: "Trialing", label: "Trialing", count: stats.trialing ?? 0 },
    { id: "Pending", label: "Pending", count: stats.pending ?? 0 },
    { id: "Cancelling", label: "Cancelling / Expired", count: stats.cancelling ?? 0 },
    { id: "Paused", label: "Paused", count: stats.paused ?? 0 },
    { id: "Blocked", label: "Blocked", count: stats.blocked ?? 0 },
  ];

  const getName = (tenant) =>
    tenant?.tenantName ||
    [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ") ||
    tenant?.email ||
    "Tenant";

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(18,95,226,0.05)",
      }}
    >
      {/* Filter Tabs Bar */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between overflow-x-auto gap-3">
        <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 shrink-0">
          {tabs.map((tab) => {
            const isActive =
              statusFilter.toUpperCase() === tab.id.toUpperCase() ||
              (statusFilter === "ALL" && tab.id === "All");

            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-slate-100 text-slate-700"
                      : "bg-slate-200/70 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            {totalTenants || tenants.length} matching result
            {(totalTenants || tenants.length) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Toolbar (Search & Dropdown Filters) */}
      <div className="px-5 py-3.5 bg-slate-50/40 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search tenant, owner, email, subdomain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#125fe2] focus:ring-2 focus:ring-blue-100 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Plan Tier Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 outline-none bg-white text-slate-700 focus:border-[#125fe2] transition shadow-2xs cursor-pointer"
          >
            <option value="">All Plan Tiers</option>
            <option value="Free">Free</option>
            <option value="Starter">Starter</option>
            <option value="Pro">Pro / Professional</option>
            <option value="Business">Business</option>
            <option value="Enterprise">Enterprise</option>
          </select>

          {/* Subscription Status Filter */}
          <select
            value={subStatusFilter}
            onChange={(e) => setSubStatusFilter(e.target.value)}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 outline-none bg-white text-slate-700 focus:border-[#125fe2] transition shadow-2xs cursor-pointer"
          >
            <option value="">All Subscriptions</option>
            <option value="active">Active Only</option>
            <option value="trialing">Trialing Only</option>
            <option value="cancelling">Cancelling</option>
            <option value="expired">Expired</option>
            <option value="paused">Paused</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-[#125fe2] hover:text-blue-700 font-semibold px-2 py-1 flex items-center gap-1 transition cursor-pointer"
            >
              <X size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="overflow-x-auto min-h-[380px]">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <RefreshCw className="w-6 h-6 text-[#125fe2] animate-spin" />
            </div>
            <p className="text-slate-700 font-semibold text-sm">
              Loading tenants & subscriptions...
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Retrieving live records from database
            </p>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <p className="text-slate-800 font-semibold text-sm">
              Failed to load tenant data
            </p>
            <p className="text-rose-500 text-xs mt-1">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Try Again
              </button>
            )}
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Building2 size={24} />
            </div>
            <p className="text-slate-700 font-semibold text-sm">
              No tenants match your filters
            </p>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Try clearing your search query or selecting a different status filter tab above.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-3 text-xs text-[#125fe2] font-semibold hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Owner / Contact</th>
                <th className="py-3.5 px-5">Plan & Subscription</th>
                <th className="py-3.5 px-5">Renewal / Expiry</th>
                <th className="py-3.5 px-5">Usage</th>
                <th className="py-3.5 px-5">Account</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tenants.map((tenant, idx) => {
                const accountStatus = getTenantAccountStatus(tenant);
                const subStatus = getSubscriptionStatus(tenant);
                const planName = getPlanLabel(tenant);
                const userCount = tenant._count?.users ?? tenant.users?.length ?? 0;
                const contactCount = tenant._count?.contacts ?? 0;
                const broadcastCount = tenant._count?.broadcasts ?? 0;
                const daysLeft = getDaysRemaining(tenant.planPeriodEnd || tenant.subscription?.currentPeriodEnd);

                return (
                  <tr
                    key={tenant.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${getName(tenant)}`}
                    onClick={() => onViewDetails?.(tenant)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onViewDetails?.(tenant);
                      }
                    }}
                    className={`hover:bg-blue-50/20 transition-colors duration-100 group ${
                      idx % 2 === 1 ? "bg-slate-50/20" : "bg-white"
                    } cursor-pointer`}
                  >
                    {/* Organization info */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2]/10 to-[#125fe2]/20 flex items-center justify-center text-[#125fe2] font-bold text-xs flex-shrink-0 border border-[#125fe2]/10">
                          {getTenantInitials(tenant)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-xs leading-tight group-hover:text-[#125fe2] transition-colors">
                              {tenant.tenantName || tenant.name || "Unnamed Tenant"}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {tenant.subdomain
                              ? `${tenant.subdomain}.sudoreply.com`
                              : tenant.id?.substring(0, 14) + "…"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Owner & Contact */}
                    <td className="py-4 px-5">
                      <p className="text-xs font-semibold text-slate-800 leading-tight">
                        {tenant.ownerName ||
                          [tenant.firstName, tenant.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          tenant.tenantName ||
                          "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail size={10} />
                        <span>{tenant.email}</span>
                      </p>
                      {tenant.phone && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          <span>{tenant.phone}</span>
                        </p>
                      )}
                    </td>

                    {/* Plan & Subscription Status */}
                    <td className="py-4 px-5">
                      <div className="flex flex-col gap-1 items-start">
                        <PlanBadge planName={planName} />
                        <SubscriptionStatusBadge status={subStatus} />
                      </div>
                    </td>

                    {/* Renewal / Expiry Date */}
                    <td className="py-4 px-5">
                      {tenant.planPeriodEnd || tenant.subscription?.currentPeriodEnd ? (
                        <div>
                          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Calendar size={11} className="text-slate-400" />
                            <span>
                              {new Date(
                                tenant.planPeriodEnd || tenant.subscription?.currentPeriodEnd
                              ).toLocaleDateString()}
                            </span>
                          </p>
                          {daysLeft !== null && (
                            <p
                              className={`text-[10px] font-semibold mt-0.5 ${
                                daysLeft > 10
                                  ? "text-emerald-600"
                                  : daysLeft > 0
                                    ? "text-amber-600 font-bold"
                                    : "text-rose-600 font-bold"
                              }`}
                            >
                              {daysLeft > 0
                                ? `${daysLeft} days left`
                                : `Expired ${Math.abs(daysLeft)}d ago`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          No end date set
                        </span>
                      )}
                      {tenant.cancellationReason && (
                        <p
                          className="text-[9px] text-rose-500 truncate max-w-[150px] mt-0.5"
                          title={tenant.cancellationReason}
                        >
                          Reason: {tenant.cancellationReason}
                        </p>
                      )}
                    </td>

                    {/* Usage */}
                    <td className="py-4 px-5">
                      <div className="space-y-0.5 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <Users2 size={10} className="text-slate-400" />
                          <span className="text-slate-700 font-semibold">
                            {userCount} / {tenant.plan?.maxAgents || "∞"} users
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MessageSquare size={10} className="text-slate-400" />
                          <span>{contactCount} contacts</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Zap size={10} className="text-slate-400" />
                          <span>{broadcastCount} broadcasts</span>
                        </div>
                      </div>
                    </td>

                    {/* Account Status */}
                    <td className="py-4 px-5">
                      <AccountStatusBadge status={accountStatus} />
                      <p className="text-[10px] text-slate-400 mt-1">
                        {tenant.lastLogin
                          ? `Active ${getRelativeTime(tenant.lastLogin)}`
                          : "No login"}
                      </p>
                    </td>

                    {/* Actions */}
                    <td
                      className="py-4 px-5 text-right"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onManualActivate?.(tenant)}
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 transition hidden sm:inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Manual Plan Activation (Offline Payment)"
                        >
                          <PlusCircle size={12} className="text-indigo-600" />
                          <span>Manual Activation</span>
                        </button>

                        <button
                          onClick={() => onManageSubscription?.(tenant)}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 hover:border-[#125fe2] hover:bg-blue-50 text-[11px] font-semibold text-slate-600 hover:text-[#125fe2] transition hidden sm:inline-flex items-center gap-1 cursor-pointer"
                          title="Manage Subscription & Quota"
                        >
                          <CreditCard size={12} />
                          <span>Plan</span>
                        </button>

                        <ActionMenu
                          tenant={tenant}
                          onViewDetails={() => onViewDetails?.(tenant)}
                          onEdit={() => onEdit?.(tenant)}
                          onManualActivate={() => onManualActivate?.(tenant)}
                          onManageSub={() => onManageSubscription?.(tenant)}
                          onViewUsers={() => onManageTeam?.(tenant)}
                          onExtendSub={(days) => onQuickExtend?.(tenant, days)}
                          onToggleSubPause={(action) => onToggleSubPause?.(tenant, action)}
                          onExpireSub={() => onForceExpireSub?.(tenant)}
                          onSuspend={() =>
                            onToggleActivation?.(tenant.id, true, getName(tenant))
                          }
                          onActivate={() =>
                            onToggleActivation?.(tenant.id, false, getName(tenant))
                          }
                          onApprove={() =>
                            onApproveStatus?.(tenant.id, "approve", getName(tenant))
                          }
                          onBlock={() => onBlock?.(tenant)}
                          onUnblock={() => onUnblock?.(tenant)}
                          onDelete={() => onDelete?.(tenant.id, getName(tenant))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Footer */}
      {tenants.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <p>
            Showing <span className="font-semibold text-slate-700">{tenants.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalTenants || tenants.length}</span> tenants
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage?.(page - 1)}
                disabled={page <= 1}
                className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-slate-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage?.(page + 1)}
                disabled={page >= totalPages}
                className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <p>
            Synchronized <span className="font-medium text-slate-600">just now</span>
          </p>
        </div>
      )}
    </div>
  );
}
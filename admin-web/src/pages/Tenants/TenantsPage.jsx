// admin-web/src/pages/Tenants/TenantsPage.jsx (do not remove this comment)
import React, { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Sparkles,
  Clock,
  XCircle,
  Users2,
  RefreshCw,
  Plus,
} from "lucide-react";
import StatCard from "../../components/common/StatCard";
import TenantsTable from "./comps/TenantsTable";
import TenantDrawer from "./comps/TenantDrawer";
import {
  CreateTenantModal,
  EditTenantModal,
  ManageSubscriptionModal,
  TeamUsersModal,
  BlockReasonModal,
} from "./comps/modals";
import { useTenants } from "./hooks/useTenants";

export default function TenantsPage() {
  const {
    tenants,
    filteredTenants,
    totalFiltered,
    loading,
    error,
    stats,
    plans,
    toastMessage,
    handleToggleUserActivation,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    planFilter,
    setPlanFilter,
    subStatusFilter,
    setSubStatusFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    hasActiveFilters,
    resetFilters,
    fetchTenants,
    handleCreateTenant,
    handleUpdateTenant,
    handleSubscriptionAction,
    handleQuickExtend,
    handleToggleSubPause,
    handleForceExpireSub,
    handleToggleActivation,
    handleStatusChange,
    handleDeleteTenant,
  } = useTenants();

  // Modal & Drawer local states
  const [drawerTenant, setDrawerTenant] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [subModalTenant, setSubModalTenant] = useState(null);
  const [subModalInitialMode, setSubModalInitialMode] = useState("extend");
  const [usersModalTenant, setUsersModalTenant] = useState(null);
  const [blockModalTenant, setBlockModalTenant] = useState(null);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Top Summary Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StatCard
          icon={Building2}
          title="Total Tenants"
          value={stats.total}
          subtitle="All organizations"
          iconBg="bg-blue-50"
          iconColor="text-[#125fe2]"
          growth={12}
        />
        <StatCard
          icon={CheckCircle2}
          title="Active Licenses"
          value={stats.activeSub}
          subtitle="Healthy recurring"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          growth={8}
        />
        <StatCard
          icon={Sparkles}
          title="Trialing"
          value={stats.trialing}
          subtitle="14-day trials"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          icon={Clock}
          title="Pending Approvals"
          value={stats.pending}
          subtitle="Awaiting review"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={XCircle}
          title="Cancelling / Expired"
          value={stats.cancelling}
          subtitle="Ending or lapsed"
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
        <StatCard
          icon={Users2}
          title="Total Users"
          value={stats.totalUsers}
          subtitle="Platform-wide seats"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          growth={5}
        />
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#125fe2] to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
              <Building2 size={16} className="text-white" />
            </div>
            <span>Tenant & Subscription Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 ml-10">
            Unified control center to manage tenant organizations, monitor
            subscription health, extend licenses, and configure plan access.
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={fetchTenants}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:border-slate-300 transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Sync Data</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg shadow-blue-200 transition cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #125fe2 0%, #2563eb 100%)",
            }}
          >
            <Plus size={15} />
            <span>Onboard Tenant</span>
          </button>
        </div>
      </div>

      {/* ── Main Data & Table Card ── */}
      <TenantsTable
        tenants={filteredTenants}
        loading={loading}
        error={error}
        stats={stats}
        totalTenants={totalFiltered}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        planFilter={planFilter}
        setPlanFilter={setPlanFilter}
        subStatusFilter={subStatusFilter}
        setSubStatusFilter={setSubStatusFilter}
        plans={plans}
        setPage={setPage}
        setPageSize={setPageSize}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onViewDetails={(tenant) => setDrawerTenant(tenant)}
        onEdit={(tenant) => setEditingTenant(tenant)}
        onManageSubscription={(tenant) => {
          setSubModalInitialMode("extend");
          setSubModalTenant(tenant);
        }}
        onManualActivate={(tenant) => {
          setSubModalInitialMode("manual_activate");
          setSubModalTenant(tenant);
        }}
        onManageTeam={(tenant) => setUsersModalTenant(tenant)}
        onQuickExtend={(tenant, days) => handleQuickExtend(tenant, days)}
        onToggleSubPause={(tenant, action) =>
          handleToggleSubPause(tenant, action)
        }
        onForceExpireSub={(tenant) => handleForceExpireSub(tenant)}
        onToggleActivation={(id, isSuspend, name) =>
          handleToggleActivation(id, isSuspend, name)
        }
        onApproveStatus={(id, action, name) =>
          handleStatusChange(id, action, name)
        }
        onBlock={(tenant) => setBlockModalTenant(tenant)}
        onUnblock={(tenant) =>
          handleStatusChange(
            tenant.id,
            "unblock",
            tenant.tenantName || tenant.email,
          )
        }
        onDelete={(id, name) => handleDeleteTenant(id, name)}
        onCreate={() => setIsCreateOpen(true)}
        onRefresh={fetchTenants}
      />

      {/* ── Drawer Component ── */}
      {drawerTenant && (
        <TenantDrawer
          tenant={drawerTenant}
          onClose={() => setDrawerTenant(null)}
          onEdit={(t) => {
            setDrawerTenant(null);
            setEditingTenant(t);
          }}
          onManageSub={(t) => {
            setDrawerTenant(null);
            setSubModalInitialMode("extend");
            setSubModalTenant(t);
          }}
          onManualActivate={(t) => {
            setDrawerTenant(null);
            setSubModalInitialMode("manual_activate");
            setSubModalTenant(t);
          }}
          onManageTeam={(t) => {
            setDrawerTenant(null);
            setUsersModalTenant(t);
          }}
          onBlock={(t) => {
            setDrawerTenant(null);
            setBlockModalTenant(t);
          }}
          onUnblock={(t) => {
            setDrawerTenant(null);
            handleStatusChange(t.id, "unblock", t.tenantName || t.email);
          }}
        />
      )}

      {/* ── Modals ── */}
      {isCreateOpen && (
        <CreateTenantModal
          isOpen
          plans={plans}
          onClose={() => setIsCreateOpen(false)}
          onSave={async (payload) => {
            const ok = await handleCreateTenant(payload);
            if (ok) setIsCreateOpen(false);
            return ok;
          }}
        />
      )}

      {editingTenant && (
        <EditTenantModal
          isOpen
          tenant={editingTenant}
          plans={plans}
          onClose={() => setEditingTenant(null)}
          onSave={async (id, payload) => {
            const ok = await handleUpdateTenant(id, payload);
            if (ok) setEditingTenant(null);
            return ok;
          }}
        />
      )}

      {subModalTenant && (
        <ManageSubscriptionModal
          isOpen
          tenant={subModalTenant}
          initialMode={subModalInitialMode}
          plans={plans}
          onClose={() => setSubModalTenant(null)}
          onSave={handleSubscriptionAction}
        />
      )}

      {usersModalTenant && (
        <TeamUsersModal
          isOpen
          tenant={
            tenants.find((t) => t.id === usersModalTenant.id) || usersModalTenant
          }
          onClose={() => setUsersModalTenant(null)}
          onToggleUserActivation={handleToggleUserActivation}
        />
      )}

      {blockModalTenant && (
        <BlockReasonModal
          isOpen
          tenant={blockModalTenant}
          onClose={() => setBlockModalTenant(null)}
          onConfirm={(reason) => {
            const name = blockModalTenant.tenantName || blockModalTenant.email;
            const id = blockModalTenant.id;
            setBlockModalTenant(null);
            handleStatusChange(id, "block", name, reason);
          }}
        />
      )}

      {/* ── Toast ── */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl text-xs font-semibold shadow-xl border animate-in fade-in slide-in-from-top-2 duration-150 ${
            toastMessage.type === "error"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : toastMessage.type === "warning"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}

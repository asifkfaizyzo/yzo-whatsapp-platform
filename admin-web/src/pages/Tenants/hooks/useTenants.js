// admin-web/src/pages/Tenants/hooks/useTenants.js (do not remove this comment)
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  fetchTenants as fetchTenantsApi,
  registerTenant as registerTenantApi,
  updateTenant as updateTenantApi,
  approveTenant as approveTenantApi,
  blockTenant as blockTenantApi,
  unblockTenant as unblockTenantApi,
  deactivateTenant as deactivateTenantApi,
  reactivateTenant as reactivateTenantApi,
  deleteTenant as deleteTenantApi,
  deactivateUser as deactivateUserApi,
  reactivateUser as reactivateUserApi,
} from "../../../api/tenants";
import { getPlans } from "../../../api/plan";
import {
  getSubscriptionStatus,
  getTenantAccountStatus,
  getPlanLabel,
} from "../tenant.constants";

export function useTenants() {
  const [rawTenants, setRawTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);

  // Filters & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [planFilter, setPlanFilter] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const showToast = useCallback((text, type = "success") => {
    setToastMessage({ text, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // ── Data fetching ──────────────────────────────────────────────────────────
  // silent = true refreshes without replacing the table with the spinner
  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        fetchTenantsApi(),
        getPlans(),
      ]);

      if (tenantsRes.success && tenantsRes.data?.tenants) {
        setRawTenants(tenantsRes.data.tenants);
      } else if (tenantsRes.success && Array.isArray(tenantsRes.data)) {
        setRawTenants(tenantsRes.data);
      } else {
        setError(tenantsRes.message || "Failed to load tenants data.");
      }

      if (plansRes?.success && plansRes.data) {
        setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
      }
    } catch (err) {
      console.error(err);
      setError("Connection error while loading tenants data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // No arguments on purpose: safe to use directly as onClick={fetchTenants}
  const fetchTenants = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, planFilter, subStatusFilter]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredAll = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return rawTenants.filter((tenant) => {
      if (!tenant) return false;

      if (q) {
        const haystack = [
          tenant.tenantName,
          tenant.name,
          tenant.ownerName,
          tenant.firstName,
          tenant.lastName,
          tenant.email,
          tenant.username,
          tenant.subdomain,
          tenant.phone,
          tenant.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      const sub = getSubscriptionStatus(tenant);
      const account = getTenantAccountStatus(tenant);

      if (statusFilter !== "All" && statusFilter !== "ALL") {
        switch (statusFilter) {
          case "Active":
            if (sub !== "active" || account === "BLOCKED") return false;
            break;
          case "Trialing":
            if (sub !== "trialing") return false;
            break;
          case "Pending":
            if (account !== "PENDING") return false;
            break;
          case "Cancelling":
            if (!["cancelling", "canceled", "expired"].includes(sub)) return false;
            break;
          case "Paused":
            if (sub !== "paused") return false;
            break;
          case "Blocked":
            if (account !== "BLOCKED") return false;
            break;
          default:
            break;
        }
      }

      if (planFilter) {
        if (!getPlanLabel(tenant).toLowerCase().includes(planFilter.toLowerCase())) {
          return false;
        }
      }

      if (subStatusFilter) {
        if (subStatusFilter === "cancelling") {
          if (!["cancelling", "canceled"].includes(sub)) return false;
        } else if (sub !== subStatusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [rawTenants, searchQuery, statusFilter, planFilter, subStatusFilter]);

  const totalFiltered = filteredAll.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;

  const filteredTenants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAll.slice(start, start + pageSize);
  }, [filteredAll, page, pageSize]);

  // ── Stats (computed on ALL tenants, not the filtered set) ──────────────────
  const stats = useMemo(() => {
    const s = {
      total: rawTenants.length,
      activeSub: 0,
      trialing: 0,
      pending: 0,
      cancelling: 0,
      paused: 0,
      blocked: 0,
      totalUsers: 0,
    };
    rawTenants.forEach((t) => {
      const sub = getSubscriptionStatus(t);
      const account = getTenantAccountStatus(t);
      if (sub === "active" && account !== "BLOCKED") s.activeSub += 1;
      if (sub === "trialing") s.trialing += 1;
      if (account === "PENDING") s.pending += 1;
      if (["cancelling", "canceled", "expired"].includes(sub)) s.cancelling += 1;
      if (sub === "paused") s.paused += 1;
      if (account === "BLOCKED") s.blocked += 1;
      s.totalUsers += t._count?.users ?? t.users?.length ?? 0;
    });
    return s;
  }, [rawTenants]);

  const hasActiveFilters = Boolean(
    searchQuery || (statusFilter !== "All" && statusFilter !== "ALL") || planFilter || subStatusFilter
  );

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setPlanFilter("");
    setSubStatusFilter("");
  };

  // ── Action helper: runs an API call, toasts, refreshes. Returns true/false ──
  const runAction = async (apiCall, successMsg, failMsg, type = "success") => {
    try {
      const res = await apiCall();
      if (res?.success) {
        showToast(successMsg, type);
        await refresh();
        return true;
      }
      showToast(res?.message || failMsg, "error");
      return false;
    } catch (err) {
      showToast(err?.message || failMsg, "error");
      return false;
    }
  };

  // ── Tenant CRUD ────────────────────────────────────────────────────────────
  const handleCreateTenant = async (payload) => {
    setModalLoading(true);
    const ok = await runAction(
      () => registerTenantApi(payload),
      `Tenant "${payload.tenantName}" created successfully!`,
      "Failed to create tenant."
    );
    setModalLoading(false);
    return ok;
  };

  const handleUpdateTenant = async (id, payload) => {
    setModalLoading(true);
    const ok = await runAction(
      () => updateTenantApi(id, payload),
      "Tenant updated successfully!",
      "Failed to update tenant."
    );
    setModalLoading(false);
    return ok;
  };

  const handleDeleteTenant = async (id, name) => {
    if (!window.confirm(`Delete tenant "${name}"? This action cannot be undone.`)) {
      return false;
    }
    return runAction(
      () => deleteTenantApi(id),
      `Tenant "${name}" deleted.`,
      "Failed to delete tenant."
    );
  };

  // ── Account status: approve / block / unblock ──────────────────────────────
  const handleStatusChange = async (id, action, name, reason) => {
    if (action === "approve") {
      if (!window.confirm(`Approve tenant "${name}"?`)) return false;
      return runAction(
        () => approveTenantApi(id),
        `Tenant "${name}" approved.`,
        "Failed to approve tenant."
      );
    }
    if (action === "block") {
      return runAction(
        () => blockTenantApi(id, reason),
        `Tenant "${name}" blocked.`,
        "Failed to block tenant.",
        "warning"
      );
    }
    if (action === "unblock") {
      if (!window.confirm(`Unblock access for tenant "${name}"?`)) return false;
      return runAction(
        () => unblockTenantApi(id),
        `Tenant "${name}" unblocked.`,
        "Failed to unblock tenant."
      );
    }
    return false;
  };

  // Suspend / activate account
  const handleToggleActivation = async (id, isSuspend, name) => {
    if (isSuspend) {
      if (!window.confirm(`Suspend account for "${name}"?`)) return false;
      return runAction(
        () => deactivateTenantApi(id),
        `Tenant "${name}" suspended.`,
        "Failed to suspend tenant.",
        "warning"
      );
    }
    return runAction(
      () => reactivateTenantApi(id),
      `Tenant "${name}" activated.`,
      "Failed to activate tenant."
    );
  };

  // Team member activate / deactivate
  const handleToggleUserActivation = async (userId, isActive, name) => {
    if (isActive) {
      if (!window.confirm(`Deactivate team member "${name}"?`)) return false;
      return runAction(
        () => deactivateUserApi(userId),
        `"${name}" deactivated.`,
        "Failed to deactivate user.",
        "warning"
      );
    }
    return runAction(
      () => reactivateUserApi(userId),
      `"${name}" reactivated.`,
      "Failed to reactivate user."
    );
  };

  // ── Subscription handlers: STUBS until payloads are confirmed ──────────────
  const subscriptionNotWired = () => {
    showToast("Subscription action is not wired to the backend yet.", "error");
    return false;
  };
  const handleSubscriptionAction = async () => subscriptionNotWired();
  const handleQuickExtend = async () => subscriptionNotWired();
  const handleToggleSubPause = async () => subscriptionNotWired();
  const handleForceExpireSub = async () => subscriptionNotWired();

  return {
    // Data
    tenants: rawTenants, // all tenants, unfiltered
    filteredTenants, // filtered + paginated slice shown in the table
    totalFiltered,
    loading,
    error,
    stats,
    plans,
    modalLoading,
    toastMessage,
    setToastMessage,

    // Filters & pagination
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

    // Actions
    fetchTenants,
    handleCreateTenant,
    handleUpdateTenant,
    handleDeleteTenant,
    handleStatusChange,
    handleToggleActivation,
    handleToggleUserActivation,
    handleSubscriptionAction,
    handleQuickExtend,
    handleToggleSubPause,
    handleForceExpireSub,
  };
}

export default useTenants;
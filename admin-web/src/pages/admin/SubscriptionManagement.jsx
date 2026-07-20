import React, { useEffect, useState } from "react";
import { Search, Settings2, RefreshCw } from "lucide-react";
import api from "../../lib/axios";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

export default function SubscriptionManagement() {
  const confirm = useConfirm();
  const toast = useToast();

  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/subscriptions?page=${page}&limit=10&search=${search}&status=${statusFilter}&plan=${planFilter}`);
      setTenants(res.data.data.tenants);
      setTotalPages(res.data.data.totalPages);
    } catch (err) {
      toast.error("Failed to fetch subscriptions");
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
    if (action === 'expire') {
      const ok = await confirm({
        type: "danger",
        title: "Force Expire Subscription?",
        message: "The tenant will lose access immediately. This cannot be undone.",
        confirmLabel: "Force Expire",
      });
      if (!ok) return;
    }

    try {
      const payload = { action };
      if (extendDays) payload.extendDays = extendDays;

      const res = await api.patch(`/admin/subscriptions/${tenantId}`, payload);
      if (res.data.success) {
        toast.success(`Subscription updated successfully.`);
        fetchTenants();
      } else {
        toast.error(res.data.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "An error occurred.");
    }
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Subscription Management</h1>
        <p className="text-slate-500 text-xs mt-1">Monitor, pause, reactivate, or extend tenant plan status.</p>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search company or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        </form>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm rounded-xl border border-slate-200 px-4 py-2.5 outline-none bg-white font-medium text-slate-600"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="cancel_at_period_end">Cancelling</option>
            <option value="expired">Expired</option>
            <option value="paused">Paused</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
            className="text-sm rounded-xl border border-slate-200 px-4 py-2.5 outline-none bg-white font-medium text-slate-600"
          >
            <option value="">All Plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="business">Business</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="animate-spin text-blue-600" size={28} />
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-semibold">
            No active subscriptions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Company Name</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Plan</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Period End</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4.5 px-6 font-bold text-slate-800">{tenant.tenantName || "N/A"}</td>
                    <td className="py-4.5 px-6 text-slate-500">{tenant.email}</td>
                    <td className="py-4.5 px-6 capitalize">{tenant.currentPlan || "Starter"}</td>
                    <td className="py-4.5 px-6">
                      {tenant.subscriptionStatus === 'active' && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">Active</span>}
                      {tenant.subscriptionStatus === 'cancel_at_period_end' && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">Cancelling</span>}
                      {tenant.subscriptionStatus === 'expired' && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">Expired</span>}
                      {tenant.subscriptionStatus === 'paused' && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Paused</span>}
                    </td>
                    <td className="py-4.5 px-6 text-slate-500">
                      {tenant.planPeriodEnd ? new Date(tenant.planPeriodEnd).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4.5 px-6 text-right relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === tenant.id ? null : tenant.id)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Settings2 size={16} />
                      </button>

                      {activeDropdown === tenant.id && (
                        <div className="absolute right-6 top-12 z-20 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 divide-y divide-slate-100 text-left">
                          <div className="py-1">
                            {tenant.subscriptionStatus !== 'paused' ? (
                              <button onClick={() => handleAction(tenant.id, 'pause')} className="w-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                                Pause Account
                              </button>
                            ) : (
                              <button onClick={() => handleAction(tenant.id, 'reactivate')} className="w-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                                Reactivate Account
                              </button>
                            )}
                            <button onClick={() => handleAction(tenant.id, 'extend', 30)} className="w-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                              Extend 30 Days
                            </button>
                          </div>
                          <div className="py-1">
                            <button onClick={() => handleAction(tenant.id, 'expire')} className="w-full px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                              Force Expire
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-white disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-white disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
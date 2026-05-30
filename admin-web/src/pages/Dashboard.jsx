import React, { useState, useEffect } from "react";
import {
  Building2,
  Users2,
  Activity,
  DollarSign,
  Search,
  Plus,
  Filter,
  CheckCircle,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  Globe,
  X,
  UserCheck,
  TrendingUp
} from "lucide-react";

// Pre-populated realistic tenants for demonstration
const initialTenants = [
  {
    id: "tenant-1",
    name: "Acme Corporation",
    adminName: "Sarah Connor",
    adminEmail: "sarah@acme.com",
    plan: "Enterprise",
    status: "Active",
    createdAt: "2026-05-10",
    phone: "+1 (555) 234-5678",
  },
  {
    id: "tenant-2",
    name: "Starlight Retail Ltd",
    adminName: "David Miller",
    adminEmail: "david@starlight.io",
    plan: "Growth",
    status: "Active",
    createdAt: "2026-05-18",
    phone: "+44 20 7946 0958",
  },
  {
    id: "tenant-3",
    name: "Delta Logistics",
    adminName: "Elena Rostova",
    adminEmail: "elena@deltalogistics.com",
    plan: "Starter",
    status: "Pending",
    createdAt: "2026-05-27",
    phone: "+49 89 2019 3456",
  },
  {
    id: "tenant-4",
    name: "Apex Consulting",
    adminName: "Marcus Vance",
    adminEmail: "marcus@apexconsulting.co",
    plan: "Growth",
    status: "Suspended",
    createdAt: "2026-04-12",
    phone: "+61 2 9382 0192",
  },
];

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState(initialTenants);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
    name: "",
    adminName: "",
    adminEmail: "",
    plan: "Growth",
    status: "Active",
    phone: "",
  });

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Show auto-dismiss success toast
  const triggerToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 4000);
  };

  const handleInputChange = (e) => {
    setNewTenant({ ...newTenant, [e.target.name]: e.target.value });
  };

  const handleCreateTenant = (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.adminEmail || !newTenant.adminName) {
      alert("Please fill in all required fields.");
      return;
    }

    const createdTenant = {
      id: `tenant-${Date.now()}`,
      name: newTenant.name,
      adminName: newTenant.adminName,
      adminEmail: newTenant.adminEmail,
      plan: newTenant.plan,
      status: newTenant.status,
      phone: newTenant.phone || "N/A",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setTenants([createdTenant, ...tenants]);
    setIsModalOpen(false);
    triggerToast(`Tenant "${newTenant.name}" created successfully!`);

    // Reset Form
    setNewTenant({
      name: "",
      adminName: "",
      adminEmail: "",
      plan: "Growth",
      status: "Active",
      phone: "",
    });
  };

  const handleToggleStatus = (tenantId, currentStatus) => {
    const nextStatus = currentStatus === "Active" ? "Suspended" : "Active";
    setTenants(
      tenants.map((t) => (t.id === tenantId ? { ...t, status: nextStatus } : t))
    );
    triggerToast(`Tenant status updated to ${nextStatus}.`);
  };

  const handleDeleteTenant = (tenantId, name) => {
    if (window.confirm(`Are you sure you want to delete tenant "${name}"?`)) {
      setTenants(tenants.filter((t) => t.id !== tenantId));
      triggerToast(`Tenant "${name}" removed successfully.`);
    }
  };

  // Filtering Logic
  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.adminName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || tenant.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Aggregated Stats
  const totalTenantsCount = tenants.length;
  const activeTenantsCount = tenants.filter((t) => t.status === "Active").length;
  const pendingTenantsCount = tenants.filter((t) => t.status === "Pending").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Toast Message ── */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 transition-all duration-300 animate-bounce">
          <CheckCircle className="text-emerald-400 w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successToast}</span>
          <button onClick={() => setSuccessToast("")} className="text-gray-400 hover:text-white ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome, {user?.name || "Super Admin"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage system instances, track onboarding, and view platform health.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition duration-150 self-start md:self-auto"
        >
          <Plus size={18} />
          <span>New Tenant</span>
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stat 1 */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Tenants</p>
            <p className="text-3xl font-bold text-gray-900">{totalTenantsCount}</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <TrendingUp size={14} />
              <span>+2 new this month</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <Building2 size={24} />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Tenants</p>
            <p className="text-3xl font-bold text-gray-900">{activeTenantsCount}</p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>{Math.round((activeTenantsCount / totalTenantsCount) * 100) || 0}% active rate</span>
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
            <Users2 size={24} />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pending Approvals</p>
            <p className="text-3xl font-bold text-gray-900">{pendingTenantsCount}</p>
            <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <AlertCircle size={14} />
              <span>Requires attention</span>
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
            <Activity size={24} />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Platform Health</p>
            <p className="text-3xl font-bold text-gray-900">99.98%</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>All systems operational</span>
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
            <Globe size={24} />
          </div>
        </div>
      </div>

      {/* ── Tenant Management List Section ── */}
      <div className="card overflow-hidden">
        {/* Table Filter Controls Header */}
        <div className="p-5 border-b border-gray-100 bg-white flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-800">Tenant Instances</h2>
            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {filteredTenants.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tenant name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-64 focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-emerald-100 transition duration-150"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Tabs Filter */}
            <div className="flex items-center border border-gray-200 p-1 rounded-xl bg-gray-50">
              {["All", "Active", "Pending", "Suspended"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition duration-150 ${
                    statusFilter === tab
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-gray-500 hover:text-slate-800"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tenant Table */}
        <div className="overflow-x-auto">
          {filteredTenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="mx-auto w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-800 font-semibold text-sm">No tenants found</p>
              <p className="text-gray-500 text-xs mt-1">Try resetting your search or status filter tab.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-4 px-6">Tenant Name</th>
                  <th className="py-4 px-6">Administrator</th>
                  <th className="py-4 px-6">Onboarded</th>
                  <th className="py-4 px-6">License Plan</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                    {/* Tenant Brand / Name */}
                    <td className="py-4.5 px-6 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                          {tenant.name.split(" ").map(w => w.charAt(0)).join("").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{tenant.phone || "No phone info"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Admin User */}
                    <td className="py-4.5 px-6">
                      <p className="text-gray-800 font-medium">{tenant.adminName}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{tenant.adminEmail}</p>
                    </td>

                    {/* Created Date */}
                    <td className="py-4.5 px-6 text-gray-600">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{tenant.createdAt}</span>
                      </div>
                    </td>

                    {/* License Plan */}
                    <td className="py-4.5 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          tenant.plan === "Enterprise"
                            ? "bg-purple-50 text-purple-700"
                            : tenant.plan === "Growth"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {tenant.plan}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="py-4.5 px-6">
                      <span
                        className={`pill inline-flex items-center gap-1 ${
                          tenant.status === "Active"
                            ? "bg-emerald-50 text-[#059669]"
                            : tenant.status === "Pending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                        }`}
                        style={{
                          backgroundColor:
                            tenant.status === "Active"
                              ? "rgba(16, 185, 129, 0.1)"
                              : tenant.status === "Pending"
                              ? "rgba(245, 158, 11, 0.1)"
                              : "rgba(239, 68, 68, 0.1)",
                          color:
                            tenant.status === "Active"
                              ? "#059669"
                              : tenant.status === "Pending"
                              ? "#d97706"
                              : "#dc2626",
                        }}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            tenant.status === "Active"
                              ? "bg-emerald-500"
                              : tenant.status === "Pending"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span>{tenant.status}</span>
                      </span>
                    </td>

                    {/* Actions buttons */}
                    <td className="py-4.5 px-6 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition duration-150 ${
                            tenant.status === "Active"
                              ? "bg-white hover:bg-red-50 border-gray-200 text-red-600 hover:border-red-200"
                              : "bg-white hover:bg-emerald-50 border-gray-200 text-[#059669] hover:border-emerald-200"
                          }`}
                        >
                          {tenant.status === "Active" ? "Suspend" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-medium transition duration-150"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Recent Activity Logs & Info Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2 space-y-4">
          <h3 className="font-bold text-gray-800 text-base">Recent Platform Activity</h3>
          <div className="divide-y divide-gray-150">
            <div className="py-3 flex items-start gap-3">
              <span className="h-2 w-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Tenant Acme Corporation onboarded successfully</p>
                <p className="text-xs text-gray-400 mt-0.5">Today, 4:12 PM • by system</p>
              </div>
            </div>
            <div className="py-3 flex items-start gap-3">
              <span className="h-2 w-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">License plan upgraded for Starlight Retail Ltd</p>
                <p className="text-xs text-gray-400 mt-0.5">Yesterday, 11:34 AM • by superadmin</p>
              </div>
            </div>
            <div className="py-3 flex items-start gap-3">
              <span className="h-2 w-2 mt-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Tenant Apex Consulting was suspended</p>
                <p className="text-xs text-gray-400 mt-0.5">May 25, 2:10 PM • by superadmin</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-transparent">
          <h3 className="font-bold text-base">Quick Statistics Guide</h3>
          <p className="text-sm text-emerald-100 leading-relaxed">
            As a superadmin, you have full control over creating sandbox and live whatsapp routing instances. Use this dashboard to provision environments, toggle subscription plans, and suspend nodes if needed.
          </p>
          <div className="bg-emerald-600/50 rounded-2xl p-4 border border-emerald-400/25">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">System Performance</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold">12ms</p>
              <p className="text-xs text-emerald-100">average response API latency</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── New Tenant Modal (Overlay) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="text-[#10b981] w-5 h-5" />
                <span>Create New Tenant</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-150 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div>
                <label className="label">Tenant Company Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Acme Sales Corp"
                  value={newTenant.name}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Admin Name *</label>
                  <input
                    type="text"
                    name="adminName"
                    required
                    placeholder="John Doe"
                    value={newTenant.adminName}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Admin Phone</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="+1 (555) 000-0000"
                    value={newTenant.phone}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Admin Email *</label>
                <input
                  type="email"
                  name="adminEmail"
                  required
                  placeholder="admin@tenantdomain.com"
                  value={newTenant.adminEmail}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Plan Tier</label>
                  <select
                    name="plan"
                    value={newTenant.plan}
                    onChange={handleInputChange}
                    className="input py-2.5"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Growth">Growth</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="label">Initial Status</label>
                  <select
                    name="status"
                    value={newTenant.status}
                    onChange={handleInputChange}
                    className="input py-2.5"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 text-xs font-semibold shadow-sm hover:shadow"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

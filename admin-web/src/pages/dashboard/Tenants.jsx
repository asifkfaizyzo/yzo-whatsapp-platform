// admin-web/src/pages/dashboard/Tenants.jsx

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users2,
  Activity,
  Search,
  Plus,
  Filter,
  CheckCircle,
  AlertCircle,
  Calendar,
  X,
  RefreshCw,
  Trash2,
  Ban,
  Unlock,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Mail,
  Phone,
  Lock,
  Edit
} from "lucide-react";
import api from "../../lib/axios";
import axios from "axios";

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Edit Tenant Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  // View Users Modal State
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [selectedTenantForUsers, setSelectedTenantForUsers] = useState(null);

  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
    tenantName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  // Fetch tenants from backend
  const fetchTenants = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/get-all-tenants");
      if (response.data?.success && response.data?.data?.tenants) {
        setTenants(response.data.data.tenants);
      } else {
        setError("Failed to fetch tenants.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const triggerToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 4000);
  };

  const handleInputChange = (e) => {
    setNewTenant({ ...newTenant, [e.target.name]: e.target.value });
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);

    if (!newTenant.tenantName || !newTenant.email || !newTenant.password) {
      setModalError("Please fill in all required fields.");
      setModalLoading(false);
      return;
    }

    try {
      const registerBaseURL = `${import.meta.env.VITE_API_URL}/api2`;
      const response = await axios.post(`${registerBaseURL}/register`, newTenant);

      if (response.data?.success) {
        triggerToast(`Tenant "${newTenant.tenantName}" registered successfully!`);
        setIsModalOpen(false);
        // Reset Form
        setNewTenant({
          tenantName: "",
          email: "",
          password: "",
          phone: "",
          address: "",
        });
        // Re-fetch
        fetchTenants();
      } else {
        setModalError(response.data?.message || "Failed to register tenant.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      if (resData?.errors && resData.errors.length > 0) {
        setModalError(resData.errors.map((e) => e.message).join(", "));
      } else {
        setModalError(resData?.message || "Error registering tenant.");
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);

    if (!editingTenant.tenantName || !editingTenant.email) {
      setModalError("Please fill in all required fields.");
      setModalLoading(false);
      return;
    }

    try {
      const response = await api.put(`/update-tenant/${editingTenant.id}`, {
        tenantName: editingTenant.tenantName,
        email: editingTenant.email,
        phone: editingTenant.phone,
        address: editingTenant.address,
      });

      if (response.data?.success) {
        triggerToast(`Tenant "${editingTenant.tenantName}" updated successfully!`);
        setIsEditModalOpen(false);
        setEditingTenant(null);
        fetchTenants();
      } else {
        setModalError(response.data?.message || "Failed to update tenant.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      if (resData?.errors && resData.errors.length > 0) {
        setModalError(resData.errors.map((e) => e.message).join(", "));
      } else {
        setModalError(resData?.message || "Error updating tenant.");
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Toggle individual user activation by Super Admin
  const handleToggleUserActivation = async (userId, isActive, userName) => {
    const action = isActive ? "deactivate" : "reactivate";
    if (window.confirm(`Are you sure you want to ${action} user "${userName}"?`)) {
      try {
        const response = await api.patch(`/users/${userId}/${action}`);
        if (response.data?.success) {
          triggerToast(`User "${userName}" has been successfully ${isActive ? "deactivated" : "activated"}.`);

          // Update local state for immediate feedback
          const updatedUsers = selectedTenantForUsers.users.map((u) =>
            u.id === userId ? { ...u, isActive: !isActive } : u
          );

          setSelectedTenantForUsers({
            ...selectedTenantForUsers,
            users: updatedUsers,
          });

          setTenants(
            tenants.map((t) =>
              t.id === selectedTenantForUsers.id
                ? { ...t, users: updatedUsers }
                : t
            )
          );
        } else {
          alert(response.data?.message || `Failed to ${action} user.`);
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || `Error executing user ${action}.`);
      }
    }
  };

  // Toggle activation (Deactivate / Reactivate)
  const handleToggleActivation = async (tenantId, isActive, tenantName) => {
    const action = isActive ? "deactivate" : "reactivate";
    if (window.confirm(`Are you sure you want to ${action} tenant "${tenantName}"?`)) {
      try {
        const response = await api.patch(`/${action}-tenant/${tenantId}`);
        if (response.data?.success) {
          triggerToast(`Tenant "${tenantName}" has been successfully ${isActive ? "suspended" : "activated"}.`);
          fetchTenants();
        } else {
          alert(response.data?.message || `Failed to ${action} tenant.`);
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || `Error executing tenant ${action}.`);
      }
    }
  };

  // Status transitions (Approve / Block / Unblock)
  const handleStatusChange = async (tenantId, action, tenantName) => {
    let confirmMsg = `Are you sure you want to approve tenant "${tenantName}"?`;
    if (action === "block") confirmMsg = `Are you sure you want to BLOCK tenant "${tenantName}"? All user sessions will be terminated.`;
    if (action === "unblock") confirmMsg = `Are you sure you want to unblock tenant "${tenantName}"?`;

    if (window.confirm(confirmMsg)) {
      try {
        const response = await api.patch(`/${action}-tenant/${tenantId}`);
        if (response.data?.success) {
          triggerToast(`Tenant "${tenantName}" successfully ${action}ed.`);
          fetchTenants();
        } else {
          alert(response.data?.message || `Failed to ${action} tenant.`);
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || `Error executing ${action} action.`);
      }
    }
  };

  // Delete Tenant
  const handleDeleteTenant = async (tenantId, tenantName) => {
    if (window.confirm(`WARNING: Are you sure you want to permanently delete tenant "${tenantName}"? This will delete all tenant data and users. This action CANNOT be undone.`)) {
      try {
        const response = await api.delete(`/delete-tenant/${tenantId}`);
        if (response.data?.success) {
          triggerToast(`Tenant "${tenantName}" and all associated data deleted.`);
          fetchTenants();
        } else {
          alert(response.data?.message || "Failed to delete tenant.");
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || "Error deleting tenant.");
      }
    }
  };

  // Filtering Logic
  const filteredTenants = tenants.filter((tenant) => {
    if (!tenant) return false;
    const name = tenant.tenantName || "";
    const email = tenant.email || "";
    const phone = tenant.phone || "";

    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "Active") {
      matchesStatus = tenant.status === "APPROVED" && tenant.isActive === true;
    } else if (statusFilter === "Pending") {
      matchesStatus = tenant.status === "PENDING";
    } else if (statusFilter === "Suspended") {
      matchesStatus = tenant.status === "APPROVED" && tenant.isActive === false;
    } else if (statusFilter === "Blocked") {
      matchesStatus = tenant.status === "BLOCKED";
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Toast Message ── */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 transition-all duration-300 animate-bounce">
          <CheckCircle className="text-[#125EF2] w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successToast}</span>
          <button onClick={() => setSuccessToast("")} className="text-gray-400 hover:text-white ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Building2 className="text-[#125EF2]" size={28} />
            <span>Tenant Management</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Approve registered tenants, manage account statuses, suspend instances, or delete records.
          </p>
        </div>

        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={fetchTenants}
            className="btn-secondary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition duration-150"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition duration-150"
          >
            <Plus size={18} />
            <span>Onboard Tenant</span>
          </button>
        </div>
      </div>

      {/* ── main tenant table section ── */}
      <div className="card overflow-hidden">
        {/* Table Filter Controls Header */}
        <div className="p-5 border-b border-gray-100 bg-white flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-800">SaaS Instances</h2>
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
                placeholder="Search tenant, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-64 focus:outline-none focus:border-[#125EF2] focus:ring-2 focus:ring-[#CFE0FD] transition duration-150"
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
              {["All", "Active", "Pending", "Suspended", "Blocked"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition duration-150 ${statusFilter === tab
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

        {/* Tenant Table Body */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-10 h-10 text-[#125EF2] animate-spin mb-3" />
              <p className="text-gray-500 text-sm font-medium">Fetching registered tenants...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="mx-auto w-12 h-12 text-red-500 mb-3" />
              <p className="text-gray-800 font-semibold text-sm">Failed to load tenants</p>
              <p className="text-red-500 text-xs mt-1">{error}</p>
              <button onClick={fetchTenants} className="mt-4 btn-secondary py-2 px-4 rounded-xl text-xs">
                Try Again
              </button>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="mx-auto w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-800 font-semibold text-sm">No tenants match the filter</p>
              <p className="text-gray-500 text-xs mt-1">Try updating your search query or choosing another filter tab.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-4 px-6">Tenant Name</th>
                  <th className="py-4 px-6">Email / Phone</th>
                  <th className="py-4 px-6 text-center">Registered On</th>
                  <th className="py-4 px-6 text-center">Address</th>
                  <th className="py-4 px-6 text-center">Users</th>
                  <th className="py-4 px-6 text-center">Workflow Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTenants.map((tenant) => {
                  // Determine status badge colors
                  let badgeBg = "bg-[#EAF2FE] text-[#0F4FCC] border-[#CFE0FD]";
                  let badgeDot = "bg-[#125EF2]";
                  let label = "Active";

                  if (tenant.status === "PENDING") {
                    badgeBg = "bg-amber-50 text-amber-700 border-amber-100";
                    badgeDot = "bg-amber-500";
                    label = "Pending Approval";
                  } else if (tenant.status === "BLOCKED") {
                    badgeBg = "bg-rose-50 text-rose-700 border-rose-100";
                    badgeDot = "bg-rose-500";
                    label = "Blocked";
                  } else if (tenant.status === "APPROVED" && !tenant.isActive) {
                    badgeBg = "bg-slate-100 text-slate-700 border-slate-200";
                    badgeDot = "bg-slate-500";
                    label = "Suspended";
                  }

                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                      {/* Tenant Brand / Name */}
                      <td className="py-4 px-6 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                            {(tenant.tenantName || tenant.email || "Unknown")
                              .split(" ")
                              .map((w) => w.charAt(0))
                              .join("")
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{tenant.tenantName || tenant.email || "Unknown Tenant"}</p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">ID: {tenant.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="text-gray-800 font-medium flex items-center gap-1.5">
                            <Mail size={13} className="text-slate-400" />
                            <span>{tenant.email}</span>
                          </p>
                          {tenant.phone && (
                            <p className="text-xs text-gray-500 flex items-center gap-1.5">
                              <Phone size={12} className="text-slate-400" />
                              <span>{tenant.phone}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Onboarded Date */}
                      <td className="py-4 px-6 text-gray-600">
                        <div className="flex items-center justify-center gap-1.5 text-xs">
                          <Calendar size={14} className="text-gray-400" />
                          <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="py-4 px-6 text-gray-500 max-w-[150px] truncate text-center">
                        {tenant.address ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate">{tenant.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic text-xs">No address provided</span>
                        )}
                      </td>

                      {/* Users Count Column */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => {
                            setSelectedTenantForUsers(tenant);
                            setIsUsersModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition duration-150"
                          title="Click to view users list"
                        >
                          <Users2 size={13} className="text-slate-500" />
                          <span>{tenant.users?.length || 0} users</span>
                        </button>
                      </td>

                      {/* Status badge */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeBg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${badgeDot}`} />
                          <span>{label}</span>
                        </span>
                      </td>

                      {/* Actions buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex gap-2">
                          {/* Approve Pending */}
                          {tenant.status === "PENDING" && (
                            <button
                              onClick={() => handleStatusChange(tenant.id, "approve", tenant.tenantName || tenant.email || "Unknown Tenant")}
                              className="px-2.5 py-1.5 rounded-lg bg-[#EAF2FE] border border-[#CFE0FD] text-[#0F4FCC] hover:bg-[#CFE0FD] text-xs font-semibold transition duration-150"
                            >
                              Approve
                            </button>
                          )}

                          {/* Deactivate/Reactivate Approved */}
                          {tenant.status === "APPROVED" && (
                            <button
                              onClick={() => handleToggleActivation(tenant.id, tenant.isActive, tenant.tenantName || tenant.email || "Unknown Tenant")}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition duration-150 ${tenant.isActive
                                ? "bg-white hover:bg-amber-50 border-gray-200 text-amber-600 hover:border-amber-200"
                                : "bg-white hover:bg-[#EAF2FE] border-gray-200 text-[#0F4FCC] hover:border-[#CFE0FD]"
                                }`}
                            >
                              {tenant.isActive ? "Suspend" : "Activate"}
                            </button>
                          )}

                          {/* Block/Unblock */}
                          {tenant.status === "BLOCKED" ? (
                            <button
                              onClick={() => handleStatusChange(tenant.id, "unblock", tenant.tenantName || tenant.email || "Unknown Tenant")}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 text-xs font-medium transition duration-150"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(tenant.id, "block", tenant.tenantName || tenant.email || "Unknown Tenant")}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-medium transition duration-150"
                            >
                              Block
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingTenant({
                                id: tenant.id,
                                tenantName: tenant.tenantName || "",
                                email: tenant.email || "",
                                phone: tenant.phone || "",
                                address: tenant.address || "",
                              });
                              setIsEditModalOpen(false);
                              setModalError("");
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 border border-gray-200 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition duration-150 animate-in fade-in"
                            title="Edit Tenant"
                          >
                            <Edit size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteTenant(tenant.id, tenant.tenantName || tenant.email || "Unknown Tenant")}
                            className="p-1.5 rounded-lg bg-slate-50 border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition duration-150"
                            title="Delete Tenant"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── New Tenant Modal (Overlay) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="text-[#125EF2] w-5 h-5" />
                <span>Onboard New Tenant</span>
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setModalError("");
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-150 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-semibold flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="label">Tenant Company Name *</label>
                <input
                  type="text"
                  name="tenantName"
                  required
                  placeholder="e.g. Acme Sales Corp"
                  value={newTenant.tenantName}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Admin Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="admin@tenantdomain.com"
                  value={newTenant.email}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Admin Password *</label>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="••••••••"
                    value={newTenant.password}
                    onChange={handleInputChange}
                    className="input pr-10"
                  />
                  <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
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

              <div>
                <label className="label">Business Address</label>
                <input
                  type="text"
                  name="address"
                  placeholder="e.g. 123 Main St, New York, NY"
                  value={newTenant.address}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalError("");
                  }}
                  className="btn-secondary px-4 py-2 text-xs font-semibold"
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 text-xs font-semibold shadow-sm hover:shadow flex items-center gap-1.5"
                  disabled={modalLoading}
                >
                  {modalLoading ? "Creating..." : "Onboard Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Tenant Modal (Overlay) ── */}
      {isEditModalOpen && editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Edit className="text-[#125EF2] w-5 h-5" />
                <span>Edit Tenant Details</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTenant(null);
                  setModalError("");
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-150 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-semibold flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="label">Tenant Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Sales Corp"
                  value={editingTenant.tenantName}
                  onChange={(e) => setEditingTenant({ ...editingTenant, tenantName: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Admin Email *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@tenantdomain.com"
                  value={editingTenant.email}
                  onChange={(e) => setEditingTenant({ ...editingTenant, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Admin Phone</label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={editingTenant.phone}
                  onChange={(e) => setEditingTenant({ ...editingTenant, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Business Address</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Main St, New York, NY"
                  value={editingTenant.address}
                  onChange={(e) => setEditingTenant({ ...editingTenant, address: e.target.value })}
                  className="input"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTenant(null);
                    setModalError("");
                  }}
                  className="btn-secondary px-4 py-2 text-xs font-semibold"
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 text-xs font-semibold shadow-sm hover:shadow flex items-center gap-1.5"
                  disabled={modalLoading}
                >
                  {modalLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Tenant Users Modal (Overlay) ── */}
      {isUsersModalOpen && selectedTenantForUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users2 className="text-[#125EF2] w-5 h-5" />
                <span>Users created by: {selectedTenantForUsers.tenantName || selectedTenantForUsers.email || "Unknown Tenant"}</span>
              </h3>
              <button
                onClick={() => {
                  setIsUsersModalOpen(false);
                  setSelectedTenantForUsers(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-150 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {!selectedTenantForUsers.users || selectedTenantForUsers.users.length === 0 ? (
                <div className="py-8 text-center">
                  <Users2 className="mx-auto w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-600 font-semibold text-sm">No users yet</p>
                  <p className="text-gray-400 text-xs mt-1">This company has not created any team member or agent accounts.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
                    Registered Users ({selectedTenantForUsers.users.length})
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-150 rounded-2xl overflow-hidden">
                    {selectedTenantForUsers.users.map((usr) => (
                      <div key={usr.id} className="p-4 bg-white hover:bg-slate-50/50 flex items-center justify-between transition duration-150">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{usr.name}</p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">{usr.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Created Date */}
                          <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                            Joined {new Date(usr.createdAt).toLocaleDateString()}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${usr.isActive
                              ? "bg-[#EAF2FE] text-[#0F4FCC] border border-[#CFE0FD]"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${usr.isActive ? "bg-[#125EF2]" : "bg-slate-400"}`} />
                            <span>{usr.isActive ? "Active" : "Inactive"}</span>
                          </span>

                          {/* Toggle Activation Button */}
                          <button
                            onClick={() => handleToggleUserActivation(usr.id, usr.isActive, usr.name)}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition duration-150 ${usr.isActive
                              ? "bg-white hover:bg-amber-50 border-gray-200 text-amber-600 hover:border-amber-200"
                              : "bg-white hover:bg-[#EAF2FE] border-gray-200 text-[#0F4FCC] hover:border-[#CFE0FD]"
                              }`}
                          >
                            {usr.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsUsersModalOpen(false);
                  setSelectedTenantForUsers(null);
                }}
                className="btn-secondary px-5 py-2 text-xs font-semibold"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

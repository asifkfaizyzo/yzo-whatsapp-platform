// admin-web/src/pages/Tenants/comps/modals/CreateTenantModal.jsx (do not remove this comment)
import React from "react";
import { createPortal } from "react-dom";
import { Building2, X, AlertCircle, RefreshCw, Plus, Lock } from "lucide-react";

export default function CreateTenantModal({
  isOpen,
  onClose,
  onSubmit,
  newTenant,
  handleInputChange,
  loading,
  error,
}) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2] to-blue-500 flex items-center justify-center shadow-md shadow-blue-200 text-white">
              <Building2 size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Onboard New Tenant
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Register a company on SudoReply
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Admin First Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                required
                value={newTenant.firstName}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Admin Last Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                required
                value={newTenant.lastName}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Company Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="tenantName"
              required
              placeholder="e.g. Acme Corp"
              value={newTenant.tenantName}
              onChange={handleInputChange}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Admin Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="admin@company.com"
              value={newTenant.email}
              onChange={handleInputChange}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Admin Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                value={newTenant.password}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 pr-9 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
              <Lock
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Phone <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                minLength={5}
                placeholder="+91 98765 43210"
                value={newTenant.phone}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Company Size <span className="text-rose-400">*</span>
              </label>
              <select
                name="companySize"
                required
                value={newTenant.companySize}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
              >
                <option value="">Select company size</option>
                {[
                  "1-10 employees",
                  "11-50 employees",
                  "51-200 employees",
                  "201-500 employees",
                  "500+ employees",
                ].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                placeholder="City, Country"
                value={newTenant.address}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={newTenant.country}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Website URL
              </label>
              <input
                type="text"
                name="websiteUrl"
                placeholder="https://example.com"
                value={newTenant.websiteUrl}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Industry
              </label>
              <input
                type="text"
                name="industry"
                value={newTenant.industry}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Use Case
              </label>
              <textarea
                name="useCase"
                value={newTenant.useCase}
                onChange={handleInputChange}
                rows={2}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Timezone
              </label>
              <input
                type="text"
                name="timezone"
                value={newTenant.timezone}
                onChange={handleInputChange}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#125fe2] hover:bg-blue-700 text-white shadow-md shadow-blue-100 flex items-center gap-1.5 transition"
            >
              {loading ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Onboard Tenant</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
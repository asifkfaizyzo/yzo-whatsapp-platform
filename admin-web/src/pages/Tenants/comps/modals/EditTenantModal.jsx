// admin-web/src/pages/Tenants/comps/modals/EditTenantModal.jsx (do not remove this comment)
import React from "react";
import { createPortal } from "react-dom";
import { Edit, X, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";

export default function EditTenantModal({
  isOpen,
  onClose,
  onSubmit,
  editingTenant,
  setEditingTenant,
  loading,
  error,
}) {
  if (!isOpen || !editingTenant) return null;

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
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center">
              <Edit size={15} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Tenant Profile
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-52">
                {editingTenant.tenantName}
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
        <form
          onSubmit={onSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Admin First Name
              </label>
              <input
                type="text"
                value={editingTenant.firstName}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    firstName: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Admin Last Name
              </label>
              <input
                type="text"
                value={editingTenant.lastName}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    lastName: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Company Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Corp"
                value={editingTenant.tenantName}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    tenantName: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Subdomain / Username
              </label>
              <input
                type="text"
                placeholder="acme"
                value={editingTenant.username}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    username: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Admin Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="admin@company.com"
              value={editingTenant.email}
              onChange={(e) =>
                setEditingTenant({
                  ...editingTenant,
                  email: e.target.value,
                })
              }
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Phone
              </label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={editingTenant.phone}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    phone: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Company Size
              </label>
              <select
                value={editingTenant.companySize}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    companySize: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
              >
                <option value="">Not set</option>
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
                value={editingTenant.address}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    address: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Country
              </label>
              <input
                type="text"
                value={editingTenant.country}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    country: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Website
              </label>
              <input
                type="text"
                value={editingTenant.websiteUrl}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    websiteUrl: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Industry
              </label>
              <input
                type="text"
                value={editingTenant.industry}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    industry: e.target.value,
                  })
                }
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
                value={editingTenant.useCase}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    useCase: e.target.value,
                  })
                }
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
                value={editingTenant.timezone}
                onChange={(e) =>
                  setEditingTenant({
                    ...editingTenant,
                    timezone: e.target.value,
                  })
                }
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
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

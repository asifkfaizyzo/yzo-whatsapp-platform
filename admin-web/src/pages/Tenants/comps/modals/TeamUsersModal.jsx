// admin-web/src/pages/Tenants/comps/modals/TeamUsersModal.jsx (do not remove this comment)
import React from "react";
import { createPortal } from "react-dom";
import { Users2, X } from "lucide-react";
import { getInitials } from "../../tenant.constants";

export default function TeamUsersModal({
  isOpen,
  tenant,
  onClose,
  onToggleUserActivation,
}) {
  if (!isOpen || !tenant) return null;

  const users = tenant.users || [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Users2 size={15} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Tenant Team Members
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {tenant.tenantName || tenant.email}
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

        {/* User List */}
        <div className="p-5 max-h-[440px] overflow-y-auto flex-1">
          {users.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
                <Users2 className="w-6 h-6" />
              </div>
              <p className="text-slate-700 font-semibold text-sm">
                No users registered
              </p>
              <p className="text-slate-400 text-xs mt-1">
                No additional team members registered for this tenant.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                {users.length} registered team member{users.length !== 1 ? "s" : ""}
              </p>
              {users.map((usr) => (
                <div
                  key={usr.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                      {getInitials(usr.name)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {usr.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{usr.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        usr.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          usr.isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {usr.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() =>
                        onToggleUserActivation(usr.id, usr.isActive, usr.name)
                      }
                      className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition ${
                        usr.isActive
                          ? "bg-white hover:bg-amber-50 border-slate-200 text-amber-600 hover:border-amber-200"
                          : "bg-white hover:bg-blue-50 border-slate-200 text-[#125fe2] hover:border-blue-200"
                      }`}
                    >
                      {usr.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
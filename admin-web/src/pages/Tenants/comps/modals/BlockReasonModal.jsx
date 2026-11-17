// admin-web/src/pages/Tenants/comps/modals/BlockReasonModal.jsx (do not remove this comment)
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ShieldBan, X, AlertCircle, RefreshCw } from "lucide-react";

export default function BlockReasonModal({ tenant, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!tenant) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a reason of at least 5 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(tenant.id, tenant.tenantName || tenant.email, reason.trim());
    } catch (err) {
      setError(err.message || "Failed to block tenant.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200">
              <ShieldBan size={16} />
            </div>
            <div>
              <h3 className="font-bold text-rose-950 text-sm">
                Block Tenant Organization
              </h3>
              <p className="text-xs text-rose-600 font-medium mt-0.5 truncate max-w-56">
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Blocking this tenant will immediately invalidate all active sessions
            for both the organization and its registered team agents.
          </p>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Reason for Blocking <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              minLength={5}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Terms of Service violation, Fraudulent activity..."
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block text-right">
              {reason.length}/500 chars
            </span>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 flex items-center gap-1.5 transition"
            >
              {loading ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Blocking…</span>
                </>
              ) : (
                <>
                  <ShieldBan size={14} />
                  <span>Confirm Block</span>
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
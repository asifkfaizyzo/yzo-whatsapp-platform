// admin-web/src/pages/Tenants/comps/modals/ManageSubscriptionModal.jsx (do not remove this comment)
import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  CreditCard,
  X,
  PlusCircle,
  Clock,
  Sparkles,
  PauseCircle,
  CheckCircle2,
  Receipt,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { useToast } from "../../../../context/ToastContext";
import {
  getPlanLabel,
  getSubscriptionStatus,
  getDaysRemaining,
  PlanBadge,
  SubscriptionStatusBadge,
} from "../../tenant.constants";

export default function ManageSubscriptionModal({
  tenant,
  initialMode = "manual_activate",
  plans = [],
  onClose,
  onSave,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState(initialMode);

  const subObj = tenant?.subscription || {};
  const defaultPlan = plans.find((p) => p.id === subObj.planId) || plans[0];

  const [manualForm, setManualForm] = useState({
    planId: defaultPlan?.id || "",
    durationDays: "30",
    amount: defaultPlan?.monthlyPrice || "",
    paymentMethod: "offline_bank_transfer",
    paymentRef: "",
    notes: "",
  });

  const [selectedPlanId, setSelectedPlanId] = useState(
    subObj.planId || defaultPlan?.id || ""
  );
  const [extendDays, setExtendDays] = useState("30");

  const currentPlanName = getPlanLabel(tenant);
  const currentSubStatus = getSubscriptionStatus(tenant);
  const currentDaysLeft = getDaysRemaining(
    subObj.planPeriodEnd || tenant.planPeriodEnd
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (actionType === "manual_activate") {
        if (!manualForm.planId) {
          toast.error("Please select a subscription plan.");
          setLoading(false);
          return;
        }
        await onSave(tenant.id, {
          action: "manual_activate",
          planId: manualForm.planId,
          durationDays: parseInt(manualForm.durationDays) || 30,
          amount: parseFloat(manualForm.amount) || 0,
          paymentMethod: manualForm.paymentMethod,
          paymentRef: manualForm.paymentRef,
          notes: manualForm.notes,
        });
        onClose();
        return;
      }

      let payload = { action: actionType };

      if (actionType === "extend") {
        const days = parseInt(extendDays);
        if (isNaN(days) || days <= 0) {
          toast.error("Please enter a valid number of days to extend.");
          setLoading(false);
          return;
        }
        payload.extendDays = days;
      } else if (actionType === "change_plan") {
        if (!selectedPlanId) {
          toast.error("Please select a subscription plan.");
          setLoading(false);
          return;
        }
        payload.planId = selectedPlanId;
        const days = parseInt(extendDays);
        if (!isNaN(days) && days > 0) {
          payload.extendDays = days;
        }
      }

      await onSave(tenant.id, payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#125fe2] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Manage Subscription & License
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {tenant.tenantName || tenant.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current Info Ribbon */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Active Plan:</span>
            <PlanBadge planName={currentPlanName} />
          </div>
          <div className="flex items-center gap-2">
            <SubscriptionStatusBadge status={currentSubStatus} />
            {currentDaysLeft !== null && (
              <span
                className={`text-[11px] font-semibold ${
                  currentDaysLeft > 5
                    ? "text-slate-500"
                    : currentDaysLeft > 0
                    ? "text-amber-600"
                    : "text-rose-600"
                }`}
              >
                ({currentDaysLeft > 0 ? `${currentDaysLeft}d left` : "Expired"})
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 overflow-y-auto flex-1"
        >
          {/* Action Selector */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
              Select Subscription Operation
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: "manual_activate",
                  label: "Manual Offline",
                  icon: PlusCircle,
                },
                { id: "extend", label: "Extend Period", icon: Clock },
                { id: "change_plan", label: "Switch Plan", icon: Sparkles },
                {
                  id: currentSubStatus === "paused" ? "reactivate" : "pause",
                  label: currentSubStatus === "paused" ? "Reactivate" : "Pause",
                  icon:
                    currentSubStatus === "paused" ? CheckCircle2 : PauseCircle,
                },
              ].map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionType(act.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                      actionType === act.id
                        ? "border-[#125fe2] bg-blue-50/70 text-[#125fe2] shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="truncate">{act.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Operation 1: Manual Plan Activation (Offline Payment) */}
          {actionType === "manual_activate" && (
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
                <Receipt size={15} />
                <span>Offline Payment & Plan Activation</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Subscription Plan
                </label>
                <select
                  value={manualForm.planId}
                  onChange={(e) => {
                    const sel = plans.find((p) => p.id === e.target.value);
                    setManualForm({
                      ...manualForm,
                      planId: e.target.value,
                      amount: sel ? sel.monthlyPrice : manualForm.amount,
                    });
                  }}
                  required
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                >
                  <option value="">-- Choose Subscription Plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{p.monthlyPrice?.toLocaleString()}/mo (
                      {p.maxAgents || "∞"} agents)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={manualForm.durationDays}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        durationDays: e.target.value,
                      })
                    }
                    required
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Base Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualForm.amount}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, amount: e.target.value })
                    }
                    required
                    placeholder="e.g. 4999"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={manualForm.paymentMethod}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                  >
                    <option value="offline_bank_transfer">
                      Bank Transfer (IMPS/NEFT)
                    </option>
                    <option value="direct_upi">Direct UPI</option>
                    <option value="cash">Cash Payment</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Bank Ref / Txn ID
                  </label>
                  <input
                    type="text"
                    value={manualForm.paymentRef}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        paymentRef: e.target.value,
                      })
                    }
                    placeholder="e.g. IMPS 987654321"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Admin Internal Note
                </label>
                <input
                  type="text"
                  value={manualForm.notes}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, notes: e.target.value })
                  }
                  placeholder="e.g. Payment verified by Admin."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                />
              </div>

              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <Receipt size={15} className="text-emerald-600 shrink-0" />
                <span>
                  Generates an official invoice and immediately syncs to Revenue Hub.
                </span>
              </div>
            </div>
          )}

          {/* Operation 2: Extend Validity Period */}
          {actionType === "extend" && (
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 animate-in fade-in duration-150">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Extend Validity Period (Days)</span>
                <span className="text-indigo-600 font-semibold">
                  {extendDays} Days
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "+7 Days", val: "7" },
                  { label: "+14 Days", val: "14" },
                  { label: "+30 Days (1 Mo)", val: "30" },
                  { label: "+60 Days", val: "60" },
                  { label: "+90 Days (Quarter)", val: "90" },
                  { label: "+365 Days (1 Yr)", val: "365" },
                ].map((chip) => (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => setExtendDays(chip.val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      extendDays === chip.val
                        ? "bg-[#125fe2] text-white border-[#125fe2] shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  placeholder="Custom number of days"
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                />
              </div>
            </div>
          )}

          {/* Operation 3: Change Plan Tier */}
          {actionType === "change_plan" && (
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 animate-in fade-in duration-150">
              <label className="text-xs font-bold text-slate-700 block">
                Select New Plan Tier
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
              >
                <option value="">-- Choose a Plan Tier --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (₹{p.monthlyPrice?.toLocaleString() || 0}/mo) ·{" "}
                    {p.maxAgents || "∞"} agents
                  </option>
                ))}
              </select>

              <div className="pt-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Active Duration for this Plan (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#125fe2]"
                />
              </div>
            </div>
          )}

          {/* Operation 4: Pause / Reactivate */}
          {(actionType === "pause" || actionType === "reactivate") && (
            <div className="p-4 rounded-2xl border bg-amber-50/60 border-amber-200/60 text-xs text-amber-800 space-y-1 animate-in fade-in duration-150">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>
                  {actionType === "pause"
                    ? "Pause Tenant Subscription"
                    : "Reactivate Tenant Subscription"}
                </span>
              </p>
              <p className="text-[11px] text-amber-700">
                {actionType === "pause"
                  ? "This will pause the tenant's premium access immediately until manually reactivated."
                  : "This will immediately restore full platform and feature access for the tenant."}
              </p>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
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
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#125fe2] hover:bg-blue-700 text-white shadow-md shadow-blue-200 flex items-center gap-1.5 transition"
            >
              {loading ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Processing…</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>
                    {actionType === "manual_activate"
                      ? "Activate Plan & Sync Revenue"
                      : "Apply Changes"}
                  </span>
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
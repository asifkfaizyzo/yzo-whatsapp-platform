// tenant-web/src/components/billing/PauseSubscriptionModal.jsx
import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  PauseCircle,
  ShieldCheck,
  Zap,
  Calendar,
  X,
  AlertCircle,
  Check,
} from "lucide-react";
import { pauseSubscription } from "../../services/billing.service";
import { useToast } from "../../context/ToastContext";

export default function PauseSubscriptionModal({
  isOpen,
  onClose,
  planName = "Current Plan",
  onSuccess,
}) {
  const toast = useToast();
  const [duration, setDuration] = useState("1_month");
  const [reason, setReason] = useState("temporary_break");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const durationOptions = [
    {
      id: "1_month",
      title: "Pause for 1 Month (30 Days)",
      desc: "Skip next month's billing. Preserves all templates & automations.",
      tag: "Popular",
    },
    {
      id: "2_months",
      title: "Pause for 2 Months (60 Days)",
      desc: "Great for seasonal breaks or quarterly project holds.",
    },
    {
      id: "indefinite",
      title: "Pause Indefinitely",
      desc: "Stay paused with zero charges until you click Resume.",
    },
  ];

  const handleConfirmPause = async () => {
    setLoading(true);
    try {
      const res = await pauseSubscription({
        pauseDuration: duration,
        reason: reason,
      });

      if (res.success) {
        toast.success("Subscription paused successfully. Your data is safely preserved.");
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.message || "Failed to pause subscription");
      }
    } catch (err) {
      console.error("Pause error:", err);
      toast.error("An error occurred while pausing subscription");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      style={{ zIndex: 99999 }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <PauseCircle size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Pause Subscription
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Hold billing without cancelling your account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Benefit Highlights Callout */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              While your subscription is paused:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>Zero renewal charges</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>WhatsApp numbers safe</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>Templates & bots preserved</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[#125EF2] shrink-0" />
                <span>1-Click resume anytime</span>
              </div>
            </div>
          </div>

          {/* Pause Duration Options */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Select Pause Duration:
            </label>
            <div className="space-y-2.5">
              {durationOptions.map((opt) => {
                const isSelected = duration === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setDuration(opt.id)}
                    className={`relative p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/40 shadow-xs"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-800">
                            {opt.title}
                          </p>
                          {opt.tag && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-800 rounded-full">
                              {opt.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Reason for pausing (Optional):
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            >
              <option value="temporary_break">Taking a short break / Holiday</option>
              <option value="seasonal_business">Seasonal business off-period</option>
              <option value="budget_restructure">Temporary budget pause</option>
              <option value="testing_paused">Campaign testing complete</option>
              <option value="other">Other reason</option>
            </select>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Keep Plan Active
          </button>
          <button
            onClick={handleConfirmPause}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Pausing Subscription...</span>
            ) : (
              <>
                <PauseCircle size={15} />
                <span>Pause Subscription</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}

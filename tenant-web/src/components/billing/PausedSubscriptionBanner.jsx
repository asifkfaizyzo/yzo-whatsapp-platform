// tenant-web/src/components/billing/PausedSubscriptionBanner.jsx
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { PauseCircle, Play, CheckCircle2, X } from "lucide-react";
import { resumeSubscription } from "../../services/billing.service";
import { useToast } from "../../context/ToastContext";
import { useAuthStore } from "../../store/useAuthStore";

export default function PausedSubscriptionBanner() {
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const toast = useToast();
  const { user, login, accessToken } = useAuthStore();

  const handleResume = async () => {
    setLoading(true);
    try {
      const res = await resumeSubscription();
      if (res.success) {
        toast.success("Subscription resumed successfully! Your platform features are active.");
        if (user) {
          login({ ...user, subscriptionStatus: "active", planStatus: "active", autopayEnabled: true }, accessToken);
        }
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        toast.error(res.message || "Failed to resume subscription");
      }
    } catch (err) {
      console.error("Error resuming subscription:", err);
      toast.error("Failed to resume subscription");
    } finally {
      setLoading(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="mb-6 rounded-2xl bg-purple-50 border border-purple-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600 text-white rounded-xl shrink-0 shadow-sm">
            <PauseCircle size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-purple-950">Subscription is currently paused</p>
            <p className="text-xs text-purple-800 mt-0.5">
              Zero renewal charges are being debited. All templates, contacts, WhatsApp numbers, and automations are safely preserved.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsConfirmOpen(true)}
          disabled={loading}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-xs font-bold text-white transition shadow-sm leading-none"
        >
          <Play size={14} className="shrink-0" />
          <span>Resume Subscription</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <Play size={20} className="fill-white translate-x-0.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Resume Subscription
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Reactivate your plan and automated messaging
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsConfirmOpen(false)} 
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to resume your subscription?
              </p>
              <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-3.5 text-xs text-emerald-900 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Your recurring Autopay schedule will resume on Razorpay.</span>
                </p>
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Outbound WhatsApp broadcasts and bot flows will be reactivated.</span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Keep Paused
              </button>
              <button
                onClick={handleResume}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? "Resuming..." : (
                  <>
                    <Play size={14} className="fill-white" />
                    <span>Yes, Resume</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}

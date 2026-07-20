import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, X } from "lucide-react";
import api from "../../lib/axios";
import { createPortal } from "react-dom";

export default function CancelSubscriptionModal({ isOpen, onClose, planName, periodEndDate, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState("");
  const [additionalComment, setAdditionalComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatModalDate = (dateVal) => {
    if (!dateVal || dateVal === "N/A") return "—";
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedReason("");
      setAdditionalComment("");
      setError(null);
    }
  }, [isOpen]);

  const handleCancelSubmit = async () => {
    if (!selectedReason) {
      setError("Please select a reason for cancelling");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post("/billing/cancel", {
        reason: selectedReason,
        additionalComment
      });
      if (res.data.success) {
        setCurrentStep(3);
      } else {
        setError(res.data.message || "Failed to cancel subscription.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    if (currentStep === 3 && onSuccess) {
      onSuccess();
    }
  };

  if (!isOpen) return null;

  const handleReactivate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post("/billing/reactivate");
      if (res.data.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.data.message || "Failed to reactivate.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred during reactivation.");
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" style={{ zIndex: 99999 }}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            {currentStep === 3 ? "Cancellation Confirmed" : "Cancel Subscription"}
          </h3>
          <button onClick={handleClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
              <ShieldAlert className="shrink-0 mt-0.5" size={18} />
              <span>{error}</span>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-4 mb-5">
                <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Cancelling your {planName} Plan</p>
                  <p className="text-xs text-amber-700">Active billing period runs until {formatModalDate(periodEndDate)}</p>
                </div>
              </div>

              <p className="text-sm font-medium text-slate-800 mb-3">Here is what you will lose when the period ends:</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-slate-600">❌ Dashboard and metrics analytics reports</li>
                <li className="flex items-center gap-2 text-sm text-slate-600">❌ Automated keywords triggers and bot responses</li>
                <li className="flex items-center gap-2 text-sm text-slate-600">❌ Sending contact broadcasts and templates</li>
                <li className="flex items-center gap-2 text-sm text-slate-600">❌ Team agent routing and support ticket resolution</li>
              </ul>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-6">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  ℹ️ <strong>Data Retention Policy</strong>: Your configurations and contacts will remain safe for 90 days after access ends, giving you full opportunity to resubscribe.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Keep My Plan
                </button>
                <button onClick={() => setCurrentStep(2)} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition">
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-4">Please tell us why you want to cancel:</p>
              <div className="space-y-3 mb-6">
                {[
                  { value: "too_expensive", label: "Too expensive" },
                  { value: "missing_features", label: "Missing features I need" },
                  { value: "switching_tool", label: "Switching to another tool" },
                  { value: "not_using_enough", label: "Not using it enough" },
                  { value: "other", label: "Other" }
                ].map((reason) => (
                  <label key={reason.value} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason.value}
                      checked={selectedReason === reason.value}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{reason.label}</span>
                  </label>
                ))}
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Additional Comments (Optional)</label>
                <textarea
                  value={additionalComment}
                  onChange={(e) => setAdditionalComment(e.target.value)}
                  placeholder="Help us improve..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button onClick={() => setCurrentStep(1)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Back
                </button>
                <button
                  onClick={handleCancelSubmit}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-sm font-semibold text-white transition flex items-center gap-2"
                >
                  {isLoading ? "Cancelling..." : "Cancel Subscription"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 mb-4 border border-emerald-100">
                <CheckCircle size={36} />
              </div>
              <h4 className="text-xl font-bold text-slate-800 mb-2">Subscription Cancelled</h4>
              <p className="text-sm text-slate-600 mb-6 px-4">
                Your cancellation has been confirmed. You will retain full dashboard features until <strong>{formatModalDate(periodEndDate)}</strong>.
              </p>

              <div className="flex flex-col gap-2.5">
                <button onClick={handleClose} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white transition text-center flex items-center justify-center">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
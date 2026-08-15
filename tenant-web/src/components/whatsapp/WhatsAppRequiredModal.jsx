import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Smartphone, ArrowRight, X, AlertTriangle, ShieldCheck, Zap } from "lucide-react";

export default function WhatsAppRequiredModal({
  isOpen,
  onClose,
  onConnect,
  title = "WhatsApp Account Required",
  description = "To create message templates and launch broadcast campaigns, you need to connect your official WhatsApp Business Account first.",
  feature = "Templates & Broadcasts"
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleConnectClick = () => {
    onClose();
    if (onConnect) {
      onConnect();
    } else {
      navigate("/dashboard/settings?tab=whatsapp");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 -mt-10 -ml-10 w-40 h-40 bg-[#125fe2]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X size={18} />
        </button>

        <div className="p-7 text-center flex flex-col items-center">
          {/* WhatsApp Badge / Icon */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Smartphone size={32} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
              <AlertTriangle size={12} strokeWidth={3} />
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            {title}
          </h3>

          <p className="mt-2.5 text-sm text-slate-500 leading-relaxed max-w-xs">
            {description}
          </p>

          {/* Quick Perks / Requirements list */}
          <div className="mt-5 w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>Official Meta Cloud API Verification</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <Zap size={16} className="text-[#125fe2] shrink-0" />
              <span>Live message delivery & quality metrics</span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors flex-1"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={handleConnectClick}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all flex-1 flex items-center justify-center gap-1.5"
            >
              <span>Connect WhatsApp</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

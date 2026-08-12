import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Trash2,
  ShieldBan,
  Info,
  X,
} from "lucide-react";

// ─── Context ─────────────────────────────────────────────────────────────────

const ConfirmContext = createContext(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx.confirm;
}

// ─── Modal UI ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  danger: {
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
    Icon: Trash2,
    confirmClass:
      "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200/60",
  },
  warning: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    Icon: AlertTriangle,
    confirmClass:
      "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200/60",
  },
  info: {
    iconBg: "bg-blue-50",
    iconColor: "text-[#125fe2]",
    Icon: Info,
    confirmClass:
      "bg-[#125fe2] hover:bg-[#0f4fc8] text-white shadow-blue-200/60",
  },
  default: {
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    Icon: ShieldBan,
    confirmClass:
      "bg-[#125fe2] hover:bg-[#0f4fc8] text-white shadow-blue-200/60",
  },
};

function ConfirmModal({ state, onConfirm, onCancel }) {
  if (!state.open) return null;

  const cfg = TYPE_CONFIG[state.type] || TYPE_CONFIG.default;
  const { Icon } = cfg;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "cmBackdropIn 0.18s ease forwards" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[3px]"
        onClick={onCancel}
      />

      {/* Card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
        style={{ animation: "cmCardIn 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
      >
        {/* Top accent bar */}
        <div
          className={`h-1 w-full ${
            state.type === "danger"
              ? "bg-gradient-to-r from-rose-400 to-rose-600"
              : state.type === "warning"
              ? "bg-gradient-to-r from-amber-400 to-amber-500"
              : "bg-gradient-to-r from-[#125fe2] to-blue-400"
          }`}
        />

        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="px-6 pt-6 pb-5">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-2xl ${cfg.iconBg} flex items-center justify-center mb-4`}
            style={{ animation: "cmIconPop 0.3s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}
          >
            <Icon size={22} className={cfg.iconColor} />
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 mb-1.5">
            {state.title}
          </h3>

          {/* Message */}
          {state.message && (
            <p className="text-sm text-slate-500 leading-relaxed">
              {state.message}
            </p>
          )}

          {/* Detail */}
          {state.detail && (
            <p className="mt-2 text-xs text-slate-400 leading-relaxed bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
              {state.detail}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {state.cancelLabel || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-lg transition-all duration-150 active:scale-95 ${cfg.confirmClass}`}
          >
            {state.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cmBackdropIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes cmCardIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
        @keyframes cmIconPop {
          from { transform: scale(0.6); opacity: 0 }
          to   { transform: scale(1); opacity: 1 }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  open: false,
  type: "danger",
  title: "",
  message: "",
  detail: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        type: opts.type || "danger",
        title: opts.title || "Are you sure?",
        message: opts.message || "",
        detail: opts.detail || "",
        confirmLabel: opts.confirmLabel || "Confirm",
        cancelLabel: opts.cancelLabel || "Cancel",
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(false);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal state={state} onConfirm={handleConfirm} onCancel={handleCancel} />
    </ConfirmContext.Provider>
  );
}

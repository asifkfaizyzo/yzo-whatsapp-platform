import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from "lucide-react";

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const VARIANT_CONFIG = {
  success: {
    Icon: CheckCircle2,
    iconColor: "text-emerald-500",
    bar: "bg-emerald-500",
    border: "border-emerald-100",
    label: "Success",
    labelColor: "text-emerald-700",
  },
  error: {
    Icon: XCircle,
    iconColor: "text-rose-500",
    bar: "bg-rose-500",
    border: "border-rose-100",
    label: "Error",
    labelColor: "text-rose-700",
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: "text-amber-500",
    bar: "bg-amber-400",
    border: "border-amber-100",
    label: "Warning",
    labelColor: "text-amber-700",
  },
  info: {
    Icon: Info,
    iconColor: "text-[#125EF2]",
    bar: "bg-[#125EF2]",
    border: "border-blue-100",
    label: "Info",
    labelColor: "text-[#125EF2]",
  },
  loading: {
    Icon: Loader2,
    iconColor: "text-slate-400 animate-spin",
    bar: "bg-slate-300",
    border: "border-slate-100",
    label: "Please wait…",
    labelColor: "text-slate-500",
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

const DURATION = 4500;

function ToastItem({ id, variant = "success", message, onRemove, persistent }) {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const { Icon } = cfg;
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);

  // Trigger enter animation after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(id), 300);
  }, [id, onRemove]);

  // Auto-dismiss only for non-persistent (non-loading) toasts
  useEffect(() => {
    if (persistent) return;
    const t = setTimeout(dismiss, DURATION);
    return () => clearTimeout(t);
  }, [dismiss, persistent]);

  return (
    <div
      style={{
        transition: "all 0.32s cubic-bezier(0.16,1,0.3,1)",
        opacity: exiting ? 0 : entered ? 1 : 0,
        transform: exiting
          ? "translateX(110%) scale(0.95)"
          : entered
          ? "translateX(0) scale(1)"
          : "translateX(100%) scale(0.95)",
      }}
      className={`flex items-start w-80 rounded-2xl border ${cfg.border} bg-white shadow-xl shadow-slate-200/60 overflow-hidden`}
    >
      {/* Left color bar */}
      <div
        className={`w-1 self-stretch flex-shrink-0 transition-colors duration-500 ${cfg.bar}`}
      />

      {/* Content */}
      <div className="flex items-start gap-3 py-3 px-3 flex-1 min-w-0">
        <Icon
          size={17}
          className={`${cfg.iconColor} flex-shrink-0 mt-0.5 transition-all duration-300`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-bold ${cfg.labelColor} mb-0.5 transition-colors duration-300`}
          >
            {cfg.label}
          </p>
          <p className="text-xs text-slate-600 leading-relaxed break-words">
            {message}
          </p>
        </div>
        {/* Hide dismiss on loading toasts */}
        {!persistent && (
          <button
            onClick={dismiss}
            className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors mt-0.5"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Container (portal) ───────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return createPortal(
    <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onRemove={onRemove} />
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((variant, message, opts = {}) => {
    const id = nextId++;
    setToasts((prev) => [
      ...prev,
      { id, variant, message, persistent: opts.persistent ?? false },
    ]);
    return id;
  }, []);

  // Update an existing toast in-place (used by promise)
  const updateToast = useCallback((id, variant, message) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, variant, message, persistent: false } : t
      )
    );
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── toast.promise ──────────────────────────────────────────────────────────
  // Usage:
  //   toast.promise(myApiCall(), {
  //     loading: "Saving...",
  //     success: "Saved!",               // or (data) => `Saved ${data.name}!`
  //     error:   "Failed to save.",      // or (err)  => err.message
  //   });
  const toastPromise = useCallback(
    (promise, { loading, success, error }) => {
      const id = addToast("loading", loading, { persistent: true });

      promise
        .then((data) => {
          const msg =
            typeof success === "function" ? success(data) : success;
          updateToast(id, "success", msg);
        })
        .catch((err) => {
          const msg =
            typeof error === "function" ? error(err) : error;
          updateToast(id, "error", msg);
        });

      return promise;
    },
    [addToast, updateToast]
  );

  const toast = {
    success: (msg) => addToast("success", msg),
    error:   (msg) => addToast("error",   msg),
    warning: (msg) => addToast("warning", msg),
    info:    (msg) => addToast("info",    msg),
    promise: toastPromise,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

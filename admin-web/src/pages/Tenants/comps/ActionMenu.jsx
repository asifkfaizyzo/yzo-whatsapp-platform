// admin-web/src/pages/Tenants/comps/ActionMenu.jsx (do not remove this comment)
import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Eye,
  Edit2,
  Users2,
  PlusCircle,
  CreditCard,
  Clock,
  PauseCircle,
  PlayCircle,
  XCircle,
  Power,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from "lucide-react";

export default function ActionMenu({
  tenant,
  onViewDetails,
  onEdit,
  onManualActivate,
  onManageSub,
  onViewUsers,
  onExtendSub,
  onToggleSubPause,
  onExpireSub,
  onSuspend,
  onActivate,
  onApprove,
  onBlock,
  onUnblock,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (e, actionFn) => {
    e.stopPropagation();
    setIsOpen(false);
    if (actionFn) actionFn();
  };

  const isBlocked = tenant?.status === "BLOCKED" || tenant?.isBlocked;
  const isPending = tenant?.status === "PENDING";
  const isSuspended = tenant?.status === "SUSPENDED" || tenant?.isActive === false;
  const subStatus = (tenant?.subscriptionStatus || tenant?.subscription?.status || "").toLowerCase();
  const isPaused = subStatus === "paused";

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition cursor-pointer"
        title="More Actions"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-1 w-56 rounded-xl bg-white shadow-xl border border-slate-100 z-50 py-1 divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Main Info Actions */}
          <div className="py-1">
            <button
              onClick={(e) => handleAction(e, onViewDetails)}
              className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
            >
              <Eye size={13} className="text-slate-400" />
              <span>View Full Details</span>
            </button>
            <button
              onClick={(e) => handleAction(e, onEdit)}
              className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
            >
              <Edit2 size={13} className="text-slate-400" />
              <span>Edit Organization</span>
            </button>
            <button
              onClick={(e) => handleAction(e, onViewUsers)}
              className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
            >
              <Users2 size={13} className="text-slate-400" />
              <span>Manage Team / Users</span>
            </button>
          </div>

          {/* Subscription & Plans */}
          <div className="py-1">
            <button
              onClick={(e) => handleAction(e, onManualActivate)}
              className="w-full text-left px-3.5 py-2 text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-semibold cursor-pointer"
            >
              <PlusCircle size={13} />
              <span>Manual Plan Activation</span>
            </button>
            <button
              onClick={(e) => handleAction(e, onManageSub)}
              className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
            >
              <CreditCard size={13} className="text-slate-400" />
              <span>Manage Subscription</span>
            </button>
            <button
              onClick={(e) => handleAction(e, () => onExtendSub?.(7))}
              className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <Clock size={13} className="text-emerald-500" />
              <span>Quick Extend +7 Days</span>
            </button>
            <button
              onClick={(e) => handleAction(e, () => onExtendSub?.(30))}
              className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <Clock size={13} className="text-emerald-600" />
              <span>Quick Extend +30 Days</span>
            </button>
            {isPaused ? (
              <button
                onClick={(e) => handleAction(e, () => onToggleSubPause?.("resume"))}
                className="w-full text-left px-3.5 py-2 text-amber-600 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <PlayCircle size={13} />
                <span>Resume Subscription</span>
              </button>
            ) : (
              <button
                onClick={(e) => handleAction(e, () => onToggleSubPause?.("pause"))}
                className="w-full text-left px-3.5 py-2 text-amber-600 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <PauseCircle size={13} />
                <span>Pause Subscription</span>
              </button>
            )}
            <button
              onClick={(e) => handleAction(e, onExpireSub)}
              className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
            >
              <XCircle size={13} />
              <span>Force Expire Sub</span>
            </button>
          </div>

          {/* Account & Approvals */}
          <div className="py-1">
            {isPending && (
              <button
                onClick={(e) => handleAction(e, onApprove)}
                className="w-full text-left px-3.5 py-2 text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-semibold cursor-pointer"
              >
                <ShieldCheck size={13} />
                <span>Approve Tenant</span>
              </button>
            )}

            {isSuspended ? (
              <button
                onClick={(e) => handleAction(e, onActivate)}
                className="w-full text-left px-3.5 py-2 text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Power size={13} />
                <span>Activate Account</span>
              </button>
            ) : (
              <button
                onClick={(e) => handleAction(e, onSuspend)}
                className="w-full text-left px-3.5 py-2 text-amber-600 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Power size={13} />
                <span>Suspend Account</span>
              </button>
            )}

            {isBlocked ? (
              <button
                onClick={(e) => handleAction(e, onUnblock)}
                className="w-full text-left px-3.5 py-2 text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <ShieldCheck size={13} />
                <span>Unblock Tenant</span>
              </button>
            ) : (
              <button
                onClick={(e) => handleAction(e, onBlock)}
                className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <ShieldAlert size={13} />
                <span>Block Tenant</span>
              </button>
            )}
          </div>

          {/* Danger Zone */}
          <div className="py-1">
            <button
              onClick={(e) => handleAction(e, onDelete)}
              className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Delete Tenant</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
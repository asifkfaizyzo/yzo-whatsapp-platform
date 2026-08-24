// admin-web/src/pages/dashboard/Tenants.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import {
  Building2,
  Users2,
  Activity,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Trash2,
  Ban,
  Unlock,
  Mail,
  Phone,
  Lock,
  Edit,
  MoreHorizontal,
  Eye,
  ShieldBan,
  ShieldCheck,
  UserCheck,
  Download,
  TrendingUp,
  Clock,
  Globe,
  BarChart2,
  MessageSquare,
  Zap,
  HardDrive,
  UserX,
  Package,
  Layers,
  Sparkles,
  Crown,
  Gem,
  Star,
  Rocket,
  CreditCard,
  CalendarDays,
  Calendar,
  SlidersHorizontal,
  PauseCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
} from "lucide-react";
import api from "../../lib/axios";
import axios from "axios";
import { getPlans } from "../../lib/planService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr) {
  if (!dateStr) return "Never";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 0) {
    if (diffHours === 0) return diffMins === 0 ? "Just now" : `${diffMins}m ago`;
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getDaysRemaining(endDateStr) {
  if (!endDateStr) return null;
  const now = new Date();
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getTenantAccountStatus(tenant) {
  if (tenant.status === "PENDING") return "Pending";
  if (tenant.status === "BLOCKED") return "Blocked";
  if (tenant.status === "APPROVED" && tenant.isActive) return "Active";
  if (tenant.status === "APPROVED" && !tenant.isActive) return "Suspended";
  return tenant.status || "Unknown";
}

function getSubscriptionStatus(tenant) {
  const subStatus = (tenant?.subscriptionStatus || "").toLowerCase();
  const planStatus = (tenant?.planStatus || "").toLowerCase();

  if (subStatus === "trialing" || planStatus === "trialing") return "trialing";
  if (subStatus === "cancel_at_period_end" || subStatus === "cancelling") return "cancelling";
  if (subStatus === "paused") return "paused";
  if (subStatus === "expired" || planStatus === "expired") return "expired";
  if (subStatus === "active" || planStatus === "active" || planStatus === "enterprise_active") return "active";
  if (planStatus === "enterprise_pending") return "pending";
  return subStatus || planStatus || "inactive";
}

function getPlanLabel(tenant) {
  if (tenant?.planStatus === "enterprise_active") return "Enterprise";
  if (tenant?.planStatus === "enterprise_pending") return "Enterprise (Pending)";
  return tenant?.plan?.name || tenant?.currentPlan || "Free";
}

function getInitials(name, fallback) {
  const str = name || fallback || "??";
  return str.split(" ").map((w) => w.charAt(0)).join("").substring(0, 2).toUpperCase();
}

// ─── Config maps ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  Suspended: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
  Blocked: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
};

const PLAN_CONFIG = {
  Free: {
    gradient: "from-slate-50 to-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    icon: Package,
    iconColor: "text-slate-500",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
  Starter: {
    gradient: "from-blue-50 to-sky-100",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Rocket,
    iconColor: "text-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  Basic: {
    gradient: "from-blue-50 to-indigo-100",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Rocket,
    iconColor: "text-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  Trial: {
    gradient: "from-violet-50 to-purple-100",
    text: "text-violet-700",
    border: "border-violet-200",
    icon: Sparkles,
    iconColor: "text-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
  Pro: {
    gradient: "from-indigo-50 to-violet-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: Star,
    iconColor: "text-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  Professional: {
    gradient: "from-indigo-50 to-violet-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: Star,
    iconColor: "text-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  Business: {
    gradient: "from-purple-50 to-fuchsia-100",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: Gem,
    iconColor: "text-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  Enterprise: {
    gradient: "from-amber-50 to-yellow-100",
    text: "text-amber-800",
    border: "border-amber-200",
    icon: Crown,
    iconColor: "text-amber-600",
    badge: "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-300 shadow-xs",
  },
};

function resolvePlanConfig(planName) {
  if (!planName) return PLAN_CONFIG["Free"];
  const clean = planName.trim().toLowerCase();
  const match = Object.keys(PLAN_CONFIG).find((k) => k.toLowerCase() === clean);
  return PLAN_CONFIG[match] || PLAN_CONFIG["Free"];
}

// ─── Reusable Components ──────────────────────────────────────────────────────

function StatCard({ icon: Icon, title, value, subtitle, iconColor, iconBg, growth }) {
  return (
    <div
      className="relative bg-white rounded-2xl border border-slate-100 p-4 flex flex-col justify-between transition-all duration-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200 cursor-default group"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(18,95,226,0.04)" }}
    >
      <div className="flex items-center justify-between relative mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        {growth !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            <TrendingUp size={10} />
            {growth >= 0 ? "+" : ""}{growth}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-600 mt-1">{title}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

function AccountStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Pending"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${cfg.dot}`} />
      {status}
    </span>
  );
}

function SubscriptionStatusBadge({ status }) {
  const st = (status || "").toLowerCase();
  switch (st) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    case "trialing":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
          <Sparkles size={11} className="text-violet-500 animate-spin-slow" />
          14-Day Trial
        </span>
      );
    case "cancelling":
    case "cancel_at_period_end":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={11} className="text-amber-500" />
          Cancelling
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle size={11} className="text-rose-500" />
          Expired
        </span>
      );
    case "paused":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <PauseCircle size={11} className="text-slate-500" />
          Paused
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          {status || "Inactive"}
        </span>
      );
  }
}

function PlanBadge({ planName }) {
  const label = planName || "Free";
  const cfg = resolvePlanConfig(label);
  const PlanIcon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.badge}`}>
      <PlanIcon size={11} className={cfg.iconColor} />
      {label}
    </span>
  );
}

// ─── 3-Dot Action Menu ────────────────────────────────────────────────────────

function ActionMenu({
  tenant,
  onViewDetails,
  onEdit,
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
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, maxHeight: 420 });
  const buttonRef = useRef(null);
  const dropdownRefVal = useRef(null);
  const accountStatus = getTenantAccountStatus(tenant);
  const subStatus = getSubscriptionStatus(tenant);

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 230;
    const margin = 8;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const measuredHeight = dropdownRefVal.current?.offsetHeight || 390;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let top;
    let maxHeight = Math.min(measuredHeight, viewportHeight - 20);

    // If space below is not enough for the full menu AND space above has more room, flip upward
    if (spaceBelow < measuredHeight && spaceAbove > spaceBelow) {
      top = Math.max(margin, rect.top - measuredHeight - 6);
      maxHeight = Math.min(measuredHeight, rect.top - margin);
    } else if (spaceBelow >= measuredHeight) {
      top = rect.bottom + 6;
      maxHeight = Math.min(measuredHeight, spaceBelow);
    } else {
      // Not enough space either way: clamp within viewport
      top = Math.max(margin, viewportHeight - measuredHeight - margin);
      maxHeight = Math.min(measuredHeight, viewportHeight - 20);
    }

    // Clamp top to never overflow bottom or top
    if (top + measuredHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - measuredHeight - margin);
    }
    if (top < margin) {
      top = margin;
    }

    // Right-aligned horizontal position
    let left = rect.right - dropdownWidth;
    if (left < margin) left = margin;
    if (left + dropdownWidth > viewportWidth - margin) {
      left = viewportWidth - dropdownWidth - margin;
    }

    setCoords({ top, left, maxHeight });
  }, []);

  const dropdownRef = useCallback(
    (node) => {
      dropdownRefVal.current = node;
      if (node !== null && buttonRef.current) {
        calculatePosition();
      }
    },
    [calculatePosition]
  );

  const handleToggle = () => {
    if (!open) {
      calculatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handleMousedown = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRefVal.current &&
        !dropdownRefVal.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (open) {
        calculatePosition();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleMousedown);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", handleMousedown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, calculatePosition]);

  const MenuItem = ({ icon: Icon, label, onClick, danger, accent, iconCls }) => (
    <button
      onClick={() => {
        onClick();
        setOpen(false);
      }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-colors duration-100 text-left font-medium ${
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : accent
          ? "text-indigo-600 hover:bg-indigo-50 font-semibold"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon size={14} className={iconCls || (danger ? "text-rose-500" : accent ? "text-indigo-500" : "text-slate-400")} />
      <span>{label}</span>
    </button>
  );

  const SectionHeader = ({ title }) => (
    <div className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {title}
    </div>
  );

  return (
    <div className="relative inline-block" ref={buttonRef}>
      <button
        onClick={handleToggle}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 ${
          open ? "bg-[#125fe2] text-white shadow-md shadow-blue-200" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        }`}
        title="More Actions"
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-1.5 divide-y divide-slate-100 overflow-y-auto"
            style={{
              top: coords.top,
              left: coords.left,
              maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : "calc(100vh - 24px)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header */}
            <div className="px-3 py-1.5">
              <p className="text-[11px] font-bold text-slate-800 truncate">{tenant.tenantName || tenant.email}</p>
              <p className="text-[9px] text-slate-400 font-mono truncate">{tenant.id}</p>
            </div>

            {/* General Section */}
            <div className="py-1">
              <MenuItem icon={Eye} label="View Full Profile" onClick={onViewDetails} />
              <MenuItem icon={Edit} label="Edit Tenant Info" onClick={onEdit} />
              <MenuItem icon={Users2} label="View Team Users" onClick={onViewUsers} />
            </div>

            {/* Subscription Lifecycle Controls */}
            <div className="py-1">
              <SectionHeader title="Subscription & Billing" />
              <MenuItem icon={Settings2} label="Manage Subscription" onClick={onManageSub} accent />
              <MenuItem
                icon={Clock}
                label="Extend +30 Days"
                onClick={() => onExtendSub(30)}
                iconCls="text-emerald-500"
              />
              {subStatus !== "paused" ? (
                <MenuItem
                  icon={PauseCircle}
                  label="Pause Subscription"
                  onClick={() => onToggleSubPause("pause")}
                  iconCls="text-amber-500"
                />
              ) : (
                <MenuItem
                  icon={CheckCircle2}
                  label="Reactivate Subscription"
                  onClick={() => onToggleSubPause("reactivate")}
                  iconCls="text-emerald-500"
                />
              )}
              <MenuItem
                icon={ShieldAlert}
                label="Force Expire Plan"
                onClick={onExpireSub}
                danger
              />
            </div>

            {/* Tenant Account Lifecycle */}
            <div className="py-1">
              <SectionHeader title="Account Access" />
              {accountStatus === "Pending" && (
                <MenuItem icon={UserCheck} label="Approve Tenant" onClick={onApprove} iconCls="text-emerald-500" />
              )}
              {accountStatus === "Active" && (
                <MenuItem icon={Ban} label="Suspend Access" onClick={onSuspend} iconCls="text-amber-500" />
              )}
              {accountStatus === "Suspended" && (
                <MenuItem icon={ShieldCheck} label="Activate Access" onClick={onActivate} iconCls="text-emerald-500" />
              )}
              {accountStatus !== "Blocked" && (
                <MenuItem icon={ShieldBan} label="Block Account" onClick={onBlock} danger />
              )}
              {accountStatus === "Blocked" && (
                <MenuItem icon={Unlock} label="Unblock Account" onClick={onUnblock} iconCls="text-emerald-500" />
              )}
            </div>

            {/* Danger Zone */}
            <div className="py-1">
              <MenuItem icon={Trash2} label="Delete Tenant" onClick={onDelete} danger />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── Manage Subscription Modal ────────────────────────────────────────────────

function ManageSubscriptionModal({ tenant, plans, onClose, onSave }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(tenant?.planId || "");
  const [extendDays, setExtendDays] = useState("30");
  const [actionType, setActionType] = useState("extend"); // 'extend', 'change_plan', 'pause', 'reactivate', 'expire'

  const currentPlanName = getPlanLabel(tenant);
  const currentSubStatus = getSubscriptionStatus(tenant);
  const currentDaysLeft = getDaysRemaining(tenant?.planPeriodEnd);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
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
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#125fe2] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Manage Subscription</h3>
              <p className="text-xs text-slate-400 mt-0.5">{tenant.tenantName || tenant.email}</p>
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
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Active Plan:</span>
            <PlanBadge planName={currentPlanName} />
          </div>
          <div className="flex items-center gap-2">
            <SubscriptionStatusBadge status={currentSubStatus} />
            {currentDaysLeft !== null && (
              <span
                className={`text-[11px] font-semibold ${currentDaysLeft > 5 ? "text-slate-500" : currentDaysLeft > 0 ? "text-amber-600" : "text-rose-600"
                  }`}
              >
                ({currentDaysLeft > 0 ? `${currentDaysLeft}d left` : "Expired"})
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Action Selector */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
              Select Subscription Operation
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "extend", label: "Extend Period", icon: Clock },
                { id: "change_plan", label: "Switch Plan", icon: Sparkles },
                {
                  id: currentSubStatus === "paused" ? "reactivate" : "pause",
                  label: currentSubStatus === "paused" ? "Reactivate" : "Pause Access",
                  icon: currentSubStatus === "paused" ? CheckCircle2 : PauseCircle,
                },
              ].map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionType(act.id)}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${actionType === act.id
                        ? "border-[#125fe2] bg-blue-50/60 text-[#125fe2] shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <Icon size={16} />
                    <span>{act.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Options */}
          {actionType === "extend" && (
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Extend Validity Period (Days)</span>
                <span className="text-indigo-600 font-semibold">{extendDays} Days</span>
              </label>

              {/* Quick chip presets */}
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${extendDays === chip.val
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

          {actionType === "change_plan" && (
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
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
                    {p.name} (₹{p.monthlyPrice?.toLocaleString() || 0}/mo) · {p.maxAgents || "∞"} agents
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

          {(actionType === "pause" || actionType === "reactivate") && (
            <div className="p-4 rounded-2xl border bg-amber-50/60 border-amber-200/60 text-xs text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>
                  {actionType === "pause" ? "Pause Tenant Subscription" : "Reactivate Tenant Subscription"}
                </span>
              </p>
              <p className="text-[11px] text-amber-700">
                {actionType === "pause"
                  ? "This will pause the tenant's premium access immediately until manually reactivated. An email notification will be dispatched."
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
                  <span>Apply Subscription Changes</span>
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

// ─── Enhanced Tenant Details Drawer ───────────────────────────────────────────

function TenantDrawer({
  tenant,
  plans,
  onClose,
  onEdit,
  onManageSub,
  onExtendSub,
  onToggleSubPause,
  onExpireSub,
  onSuspend,
  onActivate,
  onBlock,
  onDelete,
}) {
  if (!tenant) return null;
  const accountStatus = getTenantAccountStatus(tenant);
  const subStatus = getSubscriptionStatus(tenant);
  const planName = getPlanLabel(tenant);
  const planCfg = resolvePlanConfig(planName);
  const PlanIcon = planCfg.icon;

  const daysLeft = getDaysRemaining(tenant?.planPeriodEnd);
  const periodStart = tenant?.planPeriodStart || tenant?.planActivatedAt;
  const periodEnd = tenant?.planPeriodEnd;

  // Calculate percentage of time elapsed if both dates available
  let progressPercent = 0;
  if (periodStart && periodEnd) {
    const startMs = new Date(periodStart).getTime();
    const endMs = new Date(periodEnd).getTime();
    const nowMs = Date.now();
    if (endMs > startMs) {
      progressPercent = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)));
    }
  }

  const Section = ({ title, children }) => (
    <div className="border-b border-slate-100 pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</h4>
      {children}
    </div>
  );

  const Field = ({ label, value, mono }) => (
    <div className="flex flex-col gap-0.5 mb-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span
        className={`text-sm font-medium ${mono
            ? "font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 inline-block"
            : "text-slate-800"
          }`}
      >
        {value || <span className="text-slate-300 italic text-xs">Not set</span>}
      </span>
    </div>
  );

  const UsageCard = ({ icon: Icon, label, value, max, bg, iconCls }) => (
    <div className={`rounded-xl p-3 border ${bg || "bg-slate-50 border-slate-100"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={12} className={iconCls || "text-slate-400"} />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value !== undefined && value !== null ? value : "—"}</p>
      {max !== undefined && typeof value === "number" && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#125fe2] transition-all duration-700"
              style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-400 mt-0.5 block">
            {value} / {max}
          </span>
        </div>
      )}
    </div>
  );

  const TLEvent = ({ icon: Icon, label, time, iconBg, iconColor }) => (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg || "bg-blue-50"}`}>
        <Icon size={12} className={iconColor || "text-blue-500"} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{time}</p>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white"
        style={{ width: 540, maxWidth: "100vw", boxShadow: "-4px 0 60px rgba(0,0,0,0.14)" }}
      >
        {/* Header — glassmorphism */}
        <div
          className="px-6 py-5 border-b border-slate-100 flex-shrink-0 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(18,95,226,0.08) 0%, rgba(255,255,255,1) 75%)" }}
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#125fe2]/5 pointer-events-none" />
          <div className="flex items-start justify-between gap-4 relative">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#125fe2] to-[#3b82f6] flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-xl shadow-blue-200">
                {getInitials(tenant.tenantName, tenant.email)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{tenant.tenantName || tenant.email || "Unknown"}</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-56">{tenant.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <AccountStatusBadge status={accountStatus} />
                  <PlanBadge planName={planName} />
                  <SubscriptionStatusBadge status={subStatus} />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Subscription & Licensing Hero Section */}
          <Section title="Subscription & License Health">
            <div className={`rounded-2xl border p-4 mb-3 bg-gradient-to-br ${planCfg.gradient} ${planCfg.border}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-xs">
                    <PlanIcon size={18} className={planCfg.iconColor} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${planCfg.text}`}>{planName} Plan</p>
                    <p className="text-[11px] text-slate-500">
                      {tenant.plan ? `₹${tenant.plan.monthlyPrice?.toLocaleString() || 0}/mo` : "Standard Tier"} ·{" "}
                      {tenant.billingType || "Monthly billing"}
                    </p>
                  </div>
                </div>
                <SubscriptionStatusBadge status={subStatus} />
              </div>

              {/* Validity Progress Bar */}
              <div className="bg-white/80 rounded-xl p-3 border border-white mb-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Validity Period</span>
                  <span className="font-bold text-slate-800">
                    {periodEnd ? new Date(periodEnd).toLocaleDateString() : "Lifetime / No end date"}
                    {daysLeft !== null && (
                      <span className={`ml-1 text-[11px] ${daysLeft > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        ({daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"})
                      </span>
                    )}
                  </span>
                </div>
                {periodEnd && (
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${daysLeft && daysLeft <= 3 ? "bg-rose-500" : daysLeft && daysLeft <= 7 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      style={{ width: `${Math.min(100, Math.max(5, 100 - progressPercent))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Plan Limits Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Max Agents", val: tenant.plan?.maxAgents ?? "∞" },
                  { label: "Campaigns", val: tenant.plan?.maxCampaigns ?? "∞" },
                  { label: "Automations", val: tenant.plan?.maxAutomations ?? "∞" },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-white/70 rounded-xl px-2.5 py-2 text-center border border-white">
                    <p className="text-sm font-bold text-slate-800">{val}</p>
                    <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Quick Subscription Actions Bar */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/60">
                <button
                  onClick={() => onManageSub(tenant)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#125fe2] hover:bg-blue-700 text-white text-xs font-semibold transition shadow-xs"
                >
                  <Settings2 size={13} /> Manage License
                </button>
                <button
                  onClick={() => onExtendSub(30)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-xs"
                >
                  <Clock size={13} className="text-emerald-500" /> +30 Days
                </button>
                {subStatus !== "paused" ? (
                  <button
                    onClick={() => onToggleSubPause("pause")}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-xs"
                  >
                    <PauseCircle size={13} className="text-amber-500" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={() => onToggleSubPause("reactivate")}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-xs"
                  >
                    <CheckCircle2 size={13} className="text-emerald-500" /> Reactivate
                  </button>
                )}
              </div>
            </div>

            {tenant.cancellationReason && (
              <div className="p-3 bg-rose-50 border border-rose-200/60 rounded-xl text-xs text-rose-700 mb-3">
                <span className="font-bold block">Cancellation Feedback:</span>
                <p className="mt-0.5">{tenant.cancellationReason}</p>
              </div>
            )}
          </Section>

          {/* Company Information */}
          <Section title="Company Profile">
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Company Name" value={tenant.tenantName} />
              <Field label="Subdomain" value={tenant.subdomain ? `${tenant.subdomain}.sudoreply.com` : "—"} mono />
              <Field label="Tenant ID" value={tenant.id} mono />
              <Field label="Industry" value={tenant.industry} />
              <Field label="Timezone" value={tenant.timezone} />
              <Field label="Country" value={tenant.country} />
            </div>
            <Field label="Business Address" value={tenant.address} />
          </Section>

          {/* Owner Information */}
          <Section title="Owner & Primary Contact">
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Owner Name" value={tenant.ownerName || tenant.tenantName} />
              <Field label="Email" value={tenant.email} />
              <Field label="Phone" value={tenant.phone} />
              <Field label="Role" value="Tenant Admin" />
            </div>
          </Section>

          {/* Usage Analytics */}
          <Section title="Usage & Resource Quotas">
            <div className="grid grid-cols-2 gap-2.5">
              <UsageCard
                icon={Users2}
                label="Users"
                value={tenant.users?.length || 0}
                max={tenant.plan?.maxAgents}
                bg="bg-blue-50 border-blue-100"
                iconCls="text-blue-500"
              />
              <UsageCard
                icon={MessageSquare}
                label="Contacts"
                value={tenant._count?.contacts ?? "—"}
                bg="bg-indigo-50 border-indigo-100"
                iconCls="text-indigo-500"
              />
              <UsageCard
                icon={Zap}
                label="Broadcasts"
                value={tenant._count?.broadcasts ?? "—"}
                max={tenant.plan?.maxBroadcasts}
                bg="bg-purple-50 border-purple-100"
                iconCls="text-purple-500"
              />
              <UsageCard
                icon={Layers}
                label="Templates"
                value={tenant._count?.templates ?? "—"}
                bg="bg-teal-50 border-teal-100"
                iconCls="text-teal-500"
              />
              <UsageCard
                icon={Activity}
                label="Flows"
                value={tenant._count?.flows ?? "—"}
                bg="bg-amber-50 border-amber-100"
                iconCls="text-amber-500"
              />
              <UsageCard
                icon={BarChart2}
                label="Messages Sent"
                value={tenant.messagesSent ?? "—"}
                bg="bg-emerald-50 border-emerald-100"
                iconCls="text-emerald-500"
              />
              <UsageCard
                icon={HardDrive}
                label="Storage"
                value={tenant.storageUsed ? `${tenant.storageUsed} MB` : "—"}
                bg="bg-orange-50 border-orange-100"
                iconCls="text-orange-500"
              />
              <UsageCard
                icon={Globe}
                label="API Calls"
                value={tenant.apiCalls ?? "—"}
                max={tenant.plan?.maxApiCalls}
                bg="bg-pink-50 border-pink-100"
                iconCls="text-pink-500"
              />
            </div>
          </Section>

          {/* WhatsApp Status */}
          <Section title="WhatsApp Cloud API Integration">
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Phone Number ID" value={tenant.whatsappPhoneId || "Not Connected"} mono />
              <Field label="WABA ID" value={tenant.whatsappWabaId || "Not Connected"} mono />
            </div>
          </Section>

          {/* Activity Timeline */}
          <Section title="Platform Milestones">
            <div className="space-y-3">
              <TLEvent
                icon={Building2}
                label="Tenant Onboarded"
                time={tenant.createdAt ? new Date(tenant.createdAt).toLocaleString() : "—"}
                iconBg="bg-blue-50"
                iconColor="text-blue-500"
              />
              {tenant.status === "APPROVED" && (
                <TLEvent
                  icon={CheckCircle}
                  label="Account Approved"
                  time={tenant.approvedAt ? new Date(tenant.approvedAt).toLocaleString() : "Active"}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-500"
                />
              )}
              {periodStart && (
                <TLEvent
                  icon={CreditCard}
                  label={`${planName || "Plan"} Activated`}
                  time={new Date(periodStart).toLocaleString()}
                  iconBg="bg-indigo-50"
                  iconColor="text-indigo-500"
                />
              )}
            </div>
          </Section>

          {/* Danger Zone */}
          <Section title="Account Restrictions & Deletion">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
              <p className="text-xs text-rose-500 font-medium mb-3">Irreversible actions on this organization:</p>
              <div className="flex flex-wrap gap-2">
                {accountStatus === "Active" && (
                  <button
                    onClick={() => {
                      onSuspend();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-semibold transition shadow-xs"
                  >
                    <Ban size={13} /> Suspend Account
                  </button>
                )}
                {accountStatus === "Suspended" && (
                  <button
                    onClick={() => {
                      onActivate();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold transition shadow-xs"
                  >
                    <ShieldCheck size={13} /> Restore Account
                  </button>
                )}
                {accountStatus !== "Blocked" && (
                  <button
                    onClick={() => {
                      onBlock();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition shadow-xs"
                  >
                    <ShieldBan size={13} /> Block Organization
                  </button>
                )}
                <button
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold transition shadow-xs"
                >
                  <Trash2 size={13} /> Delete Tenant
                </button>
              </div>
            </div>
          </Section>
        </div>

        {/* Drawer Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/60">
          <p className="text-[11px] text-slate-400">
            Registered on {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "—"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#125fe2] text-white hover:bg-blue-700 flex items-center gap-1.5 transition shadow-xs"
            >
              <Edit size={13} /> Edit Profile
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Main Merged Tenants & Subscriptions Page ─────────────────────────────────

export default function Tenants() {
  const confirm = useConfirm();
  const toast = useToast();

  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // 'All', 'Active', 'Trialing', 'Pending', 'Cancelling', 'Paused', 'Blocked'
  const [planFilter, setPlanFilter] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("");

  // Modals & Drawer States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [selectedTenantForUsers, setSelectedTenantForUsers] = useState(null);

  const [subModalTenant, setSubModalTenant] = useState(null);
  const [drawerTenant, setDrawerTenant] = useState(null);

  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
    tenantName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const fetchTenants = async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        api.get("/get-all-tenants"),
        getPlans(),
      ]);

      if (tenantsRes.data?.success && tenantsRes.data?.data?.tenants) {
        setTenants(tenantsRes.data.data.tenants);
      } else {
        setError("Failed to fetch tenants.");
      }

      if (plansRes.success && plansRes.data) {
        setPlans(plansRes.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // ── Tenant Lifecycle Handlers ───────────────────────────────────────────────

  const handleInputChange = (e) => {
    setNewTenant({ ...newTenant, [e.target.name]: e.target.value });
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);
    if (!newTenant.tenantName || !newTenant.email || !newTenant.password) {
      setModalError("Please fill in all required fields.");
      setModalLoading(false);
      return;
    }
    try {
      const registerBaseURL = `${import.meta.env.VITE_API_URL}/api2`;
      const response = await axios.post(`${registerBaseURL}/register`, newTenant);
      if (response.data?.success) {
        toast.success(`Tenant "${newTenant.tenantName}" registered successfully!`);
        setIsModalOpen(false);
        setNewTenant({ tenantName: "", email: "", password: "", phone: "", address: "" });
        fetchTenants();
      } else {
        setModalError(response.data?.message || "Failed to register tenant.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      if (resData?.errors && resData.errors.length > 0) {
        setModalError(resData.errors.map((e) => e.message).join(", "));
      } else {
        setModalError(resData?.message || "Error registering tenant.");
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);
    if (!editingTenant.tenantName || !editingTenant.email) {
      setModalError("Please fill in all required fields.");
      setModalLoading(false);
      return;
    }
    try {
      const response = await api.put(`/update-tenant/${editingTenant.id}`, {
        tenantName: editingTenant.tenantName,
        email: editingTenant.email,
        phone: editingTenant.phone,
        address: editingTenant.address,
      });
      if (response.data?.success) {
        toast.success(`Tenant "${editingTenant.tenantName}" updated successfully!`);
        setIsEditModalOpen(false);
        setEditingTenant(null);
        fetchTenants();
      } else {
        setModalError(response.data?.message || "Failed to update tenant.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      if (resData?.errors && resData.errors.length > 0) {
        setModalError(resData.errors.map((e) => e.message).join(", "));
      } else {
        setModalError(resData?.message || "Error updating tenant.");
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleUserActivation = async (userId, isActive, userName) => {
    const action = isActive ? "deactivate" : "reactivate";
    const ok = await confirm({
      type: isActive ? "warning" : "info",
      title: `${isActive ? "Deactivate" : "Reactivate"} User?`,
      message: `Are you sure you want to ${action} user "${userName}"?`,
      confirmLabel: isActive ? "Deactivate" : "Reactivate",
    });
    if (ok) {
      try {
        const response = await api.patch(`/users/${userId}/${action}`);
        if (response.data?.success) {
          toast.success(`User "${userName}" has been ${isActive ? "deactivated" : "activated"}.`);
          const updatedUsers = selectedTenantForUsers.users.map((u) =>
            u.id === userId ? { ...u, isActive: !isActive } : u
          );
          setSelectedTenantForUsers({ ...selectedTenantForUsers, users: updatedUsers });
          setTenants(
            tenants.map((t) => (t.id === selectedTenantForUsers.id ? { ...t, users: updatedUsers } : t))
          );
        } else {
          toast.error(response.data?.message || `Failed to ${action} user.`);
        }
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || `Error executing user ${action}.`);
      }
    }
  };

  const handleToggleActivation = async (tenantId, isActive, tenantName) => {
    const action = isActive ? "deactivate" : "reactivate";
    const ok = await confirm({
      type: isActive ? "warning" : "info",
      title: `${isActive ? "Suspend" : "Activate"} Tenant?`,
      message: `Are you sure you want to ${action} tenant "${tenantName}"?`,
      confirmLabel: isActive ? "Suspend" : "Activate",
    });
    if (ok) {
      try {
        const response = await api.patch(`/${action}-tenant/${tenantId}`);
        if (response.data?.success) {
          toast.success(`Tenant "${tenantName}" has been ${isActive ? "suspended" : "activated"}.`);
          fetchTenants();
        } else {
          toast.error(response.data?.message || `Failed to ${action} tenant.`);
        }
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || `Error executing tenant ${action}.`);
      }
    }
  };

  const handleStatusChange = async (tenantId, action, tenantName) => {
    const isBlock = action === "block";
    const isUnblock = action === "unblock";
    const ok = await confirm({
      type: isBlock ? "danger" : isUnblock ? "info" : "default",
      title: isBlock ? `Block Tenant?` : isUnblock ? `Unblock Tenant?` : `Approve Tenant?`,
      message: isBlock
        ? `This will permanently block "${tenantName}" and terminate all active user sessions.`
        : isUnblock
          ? `Restore access for "${tenantName}"?`
          : `Approve "${tenantName}" and grant full platform access?`,
      confirmLabel: isBlock ? "Block" : isUnblock ? "Unblock" : "Approve",
    });
    if (ok) {
      try {
        const response = await api.patch(`/${action}-tenant/${tenantId}`);
        if (response.data?.success) {
          toast.success(`Tenant "${tenantName}" successfully ${action}ed.`);
          fetchTenants();
        } else {
          toast.error(response.data?.message || `Failed to ${action} tenant.`);
        }
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || `Error executing ${action} action.`);
      }
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    const ok = await confirm({
      type: "danger",
      title: "Delete Tenant?",
      message: `Permanently delete "${tenantName}"? This cannot be undone.`,
      detail: "All tenant data, users, contacts, templates, and configurations will be permanently erased.",
      confirmLabel: "Delete Permanently",
    });
    if (ok) {
      try {
        const response = await api.delete(`/delete-tenant/${tenantId}`);
        if (response.data?.success) {
          toast.success(`Tenant "${tenantName}" and all associated data deleted.`);
          fetchTenants();
        } else {
          toast.error(response.data?.message || "Failed to delete tenant.");
        }
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Error deleting tenant.");
      }
    }
  };

  // ── Subscription Lifecycle Handlers ─────────────────────────────────────────

  const handleSubscriptionAction = async (tenantId, payload) => {
    try {
      const res = await api.patch(`/admin/subscriptions/${tenantId}`, payload);
      if (res.data?.success) {
        toast.success(`Subscription updated successfully.`);
        fetchTenants();
        if (drawerTenant && drawerTenant.id === tenantId) {
          // Refresh drawer tenant state
          setDrawerTenant((prev) => (prev ? { ...prev, ...payload } : null));
        }
      } else {
        toast.error(res.data?.message || "Action failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Error updating subscription.");
      throw err;
    }
  };

  const handleQuickExtend = async (tenant, days = 30) => {
    const tenantName = tenant.tenantName || tenant.email;
    const ok = await confirm({
      type: "info",
      title: `Extend Subscription (+${days} Days)?`,
      message: `Add ${days} days of active license validity for "${tenantName}"?`,
      confirmLabel: `Extend +${days} Days`,
    });
    if (ok) {
      await handleSubscriptionAction(tenant.id, { action: "extend", extendDays: days });
    }
  };

  const handleToggleSubPause = async (tenant, action) => {
    const tenantName = tenant.tenantName || tenant.email;
    const isPause = action === "pause";
    const ok = await confirm({
      type: isPause ? "warning" : "info",
      title: `${isPause ? "Pause" : "Reactivate"} Subscription?`,
      message: isPause
        ? `Are you sure you want to pause subscription access for "${tenantName}"?`
        : `Reactivate active subscription for "${tenantName}"?`,
      confirmLabel: isPause ? "Pause Subscription" : "Reactivate",
    });
    if (ok) {
      await handleSubscriptionAction(tenant.id, { action });
    }
  };

  const handleForceExpireSub = async (tenant) => {
    const tenantName = tenant.tenantName || tenant.email;
    const ok = await confirm({
      type: "danger",
      title: "Force Expire Subscription?",
      message: `Tenant "${tenantName}" will lose active subscription benefits immediately and move to Expired status.`,
      confirmLabel: "Force Expire",
    });
    if (ok) {
      await handleSubscriptionAction(tenant.id, { action: "expire" });
    }
  };

  // ── Filtering & Metrics Calculation ─────────────────────────────────────────

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === "APPROVED" && t.isActive).length,
    activeSub: tenants.filter((t) => getSubscriptionStatus(t) === "active").length,
    trialing: tenants.filter((t) => getSubscriptionStatus(t) === "trialing").length,
    pending: tenants.filter((t) => t.status === "PENDING").length,
    cancelling: tenants.filter((t) => {
      const s = getSubscriptionStatus(t);
      return s === "cancelling" || s === "expired";
    }).length,
    paused: tenants.filter((t) => !t.isActive || getSubscriptionStatus(t) === "paused").length,
    blocked: tenants.filter((t) => t.status === "BLOCKED").length,
    totalUsers: tenants.reduce((acc, t) => acc + (t.users?.length || 0), 0),
  };

  const filteredTenants = tenants.filter((tenant) => {
    if (!tenant) return false;

    // Search query match
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchesSearch =
        (tenant.tenantName || "").toLowerCase().includes(q) ||
        (tenant.email || "").toLowerCase().includes(q) ||
        (tenant.phone || "").toLowerCase().includes(q) ||
        (tenant.subdomain || "").toLowerCase().includes(q) ||
        (tenant.id || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // Top Status Tab Filter
    const accStatus = getTenantAccountStatus(tenant);
    const subStatus = getSubscriptionStatus(tenant);

    if (statusFilter === "Active" && !(accStatus === "Active" || subStatus === "active")) return false;
    if (statusFilter === "Trialing" && subStatus !== "trialing") return false;
    if (statusFilter === "Pending" && accStatus !== "Pending") return false;
    if (statusFilter === "Cancelling" && !(subStatus === "cancelling" || subStatus === "expired")) return false;
    if (statusFilter === "Paused" && !(accStatus === "Suspended" || subStatus === "paused")) return false;
    if (statusFilter === "Blocked" && accStatus !== "Blocked") return false;

    // Plan dropdown filter
    if (planFilter) {
      const pLabel = getPlanLabel(tenant).toLowerCase();
      if (!pLabel.includes(planFilter.toLowerCase())) return false;
    }

    // Subscription status dropdown filter
    if (subStatusFilter) {
      if (subStatus !== subStatusFilter) return false;
    }

    return true;
  });

  const getName = (t) => t?.tenantName || t?.email || "Unknown Tenant";

  const openEditModal = (tenant) => {
    setEditingTenant({
      id: tenant.id,
      tenantName: tenant.tenantName || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      address: tenant.address || "",
    });
    setModalError("");
    setIsEditModalOpen(true);
  };

  const hasActiveFilters = searchQuery || statusFilter !== "All" || planFilter || subStatusFilter;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setPlanFilter("");
    setSubStatusFilter("");
  };

  // ── Render Page ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Top Summary Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StatCard
          icon={Building2}
          title="Total Tenants"
          value={stats.total}
          subtitle="All organizations"
          iconBg="bg-blue-50"
          iconColor="text-[#125fe2]"
          growth={12}
        />
        <StatCard
          icon={CheckCircle2}
          title="Active Licenses"
          value={stats.activeSub}
          subtitle="Healthy recurring"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          growth={8}
        />
        <StatCard
          icon={Sparkles}
          title="Trialing"
          value={stats.trialing}
          subtitle="14-day trials"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          icon={Clock}
          title="Pending Approvals"
          value={stats.pending}
          subtitle="Awaiting review"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={XCircle}
          title="Cancelling / Expired"
          value={stats.cancelling}
          subtitle="Ending or lapsed"
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
        <StatCard
          icon={Users2}
          title="Total Users"
          value={stats.totalUsers}
          subtitle="Platform-wide seats"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          growth={5}
        />
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#125fe2] to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
              <Building2 size={16} className="text-white" />
            </div>
            <span>Tenant & Subscription Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 ml-10">
            Unified control center to manage tenant organizations, monitor subscription health, extend licenses, and configure plan access.
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={fetchTenants}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:border-slate-300 transition shadow-xs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Sync Data</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg shadow-blue-200 transition"
            style={{ background: "linear-gradient(135deg, #125fe2 0%, #2563eb 100%)" }}
          >
            <Plus size={15} />
            <span>Onboard Tenant</span>
          </button>
        </div>
      </div>

      {/* ── Main Data & Table Card ── */}
      <div
        className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(18,95,226,0.05)" }}
      >
        {/* Filter Tabs Bar */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between overflow-x-auto gap-3">
          <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 shrink-0">
            {[
              { id: "All", label: "All Tenants", count: stats.total },
              { id: "Active", label: "Active", count: stats.activeSub },
              { id: "Trialing", label: "Trialing", count: stats.trialing },
              { id: "Pending", label: "Pending", count: stats.pending },
              { id: "Cancelling", label: "Cancelling / Expired", count: stats.cancelling },
              { id: "Paused", label: "Paused", count: stats.paused },
              { id: "Blocked", label: "Blocked", count: stats.blocked },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${statusFilter === tab.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${statusFilter === tab.id ? "bg-slate-100 text-slate-700" : "bg-slate-200/70 text-slate-500"
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              {filteredTenants.length} matching result{filteredTenants.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Toolbar (Search & Dropdown Filters) */}
        <div className="px-5 py-3.5 bg-slate-50/40 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search tenant, owner, email, subdomain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#125fe2] focus:ring-2 focus:ring-blue-100 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Plan Tier Filter */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 outline-none bg-white text-slate-700 focus:border-[#125fe2] transition shadow-2xs"
            >
              <option value="">All Plan Tiers</option>
              <option value="Free">Free</option>
              <option value="Starter">Starter</option>
              <option value="Pro">Pro / Professional</option>
              <option value="Business">Business</option>
              <option value="Enterprise">Enterprise</option>
            </select>

            {/* Subscription Status Filter */}
            <select
              value={subStatusFilter}
              onChange={(e) => setSubStatusFilter(e.target.value)}
              className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 outline-none bg-white text-slate-700 focus:border-[#125fe2] transition shadow-2xs"
            >
              <option value="">All Subscriptions</option>
              <option value="active">Active Only</option>
              <option value="trialing">Trialing Only</option>
              <option value="cancelling">Cancelling</option>
              <option value="expired">Expired</option>
              <option value="paused">Paused</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-[#125fe2] hover:text-blue-700 font-semibold px-2 py-1 flex items-center gap-1 transition"
              >
                <X size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Main Data Table ── */}
        <div className="overflow-x-auto min-h-[380px]">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <RefreshCw className="w-6 h-6 text-[#125fe2] animate-spin" />
              </div>
              <p className="text-slate-700 font-semibold text-sm">Loading tenants & subscriptions...</p>
              <p className="text-slate-400 text-xs mt-1">Retrieving live records from database</p>
            </div>
          ) : error ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <p className="text-slate-800 font-semibold text-sm">Failed to load tenant data</p>
              <p className="text-rose-500 text-xs mt-1">{error}</p>
              <button
                onClick={fetchTenants}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Try Again
              </button>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Building2 size={24} />
              </div>
              <p className="text-slate-700 font-semibold text-sm">No tenants match your filters</p>
              <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                Try clearing your search query or selecting a different status filter tab above.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-3 text-xs text-[#125fe2] font-semibold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                  <th className="py-3.5 px-5">Organization</th>
                  <th className="py-3.5 px-5">Owner / Contact</th>
                  <th className="py-3.5 px-5">Plan & Subscription</th>
                  <th className="py-3.5 px-5">Renewal / Expiry</th>
                  <th className="py-3.5 px-5">Usage</th>
                  <th className="py-3.5 px-5">Account</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTenants.map((tenant, idx) => {
                  const accountStatus = getTenantAccountStatus(tenant);
                  const subStatus = getSubscriptionStatus(tenant);
                  const planName = getPlanLabel(tenant);
                  const userCount = tenant.users?.length || 0;
                  const daysLeft = getDaysRemaining(tenant.planPeriodEnd);

                  return (
                    <tr
                      key={tenant.id}
                      className={`hover:bg-blue-50/20 transition-colors duration-100 group ${idx % 2 === 1 ? "bg-slate-50/20" : "bg-white"
                        }`}
                    >
                      {/* Organization info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2]/10 to-[#125fe2]/20 flex items-center justify-center text-[#125fe2] font-bold text-xs flex-shrink-0 border border-[#125fe2]/10">
                            {getInitials(tenant.tenantName, tenant.email)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 text-xs leading-tight group-hover:text-[#125fe2] transition-colors">
                                {tenant.tenantName || "Unnamed Tenant"}
                              </p>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {tenant.subdomain ? `${tenant.subdomain}.sudoreply.com` : tenant.id?.substring(0, 14) + "…"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Contact */}
                      <td className="py-4 px-5">
                        <p className="text-xs font-semibold text-slate-800 leading-tight">
                          {tenant.ownerName || tenant.tenantName || "—"}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail size={10} />
                          <span>{tenant.email}</span>
                        </p>
                        {tenant.phone && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            <span>{tenant.phone}</span>
                          </p>
                        )}
                      </td>

                      {/* Plan & Subscription Status */}
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1 items-start">
                          <PlanBadge planName={planName} />
                          <SubscriptionStatusBadge status={subStatus} />
                        </div>
                      </td>

                      {/* Renewal / Expiry Date */}
                      <td className="py-4 px-5">
                        {tenant.planPeriodEnd ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                              <Calendar size={11} className="text-slate-400" />
                              <span>{new Date(tenant.planPeriodEnd).toLocaleDateString()}</span>
                            </p>
                            {daysLeft !== null && (
                              <p
                                className={`text-[10px] font-semibold mt-0.5 ${daysLeft > 10
                                    ? "text-emerald-600"
                                    : daysLeft > 0
                                      ? "text-amber-600 font-bold"
                                      : "text-rose-600 font-bold"
                                  }`}
                              >
                                {daysLeft > 0 ? `${daysLeft} days left` : `Expired ${Math.abs(daysLeft)}d ago`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No end date set</span>
                        )}
                        {tenant.cancellationReason && (
                          <p className="text-[9px] text-rose-500 truncate max-w-[150px] mt-0.5" title={tenant.cancellationReason}>
                            Reason: {tenant.cancellationReason}
                          </p>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-5">
                        <div className="space-y-0.5 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <Users2 size={10} className="text-slate-400" />
                            <span className="text-slate-700 font-semibold">
                              {userCount} / {tenant.plan?.maxAgents || "∞"} users
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <MessageSquare size={10} className="text-slate-400" />
                            <span>{tenant._count?.contacts ?? "0"} contacts</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Zap size={10} className="text-slate-400" />
                            <span>{tenant._count?.broadcasts ?? "0"} broadcasts</span>
                          </div>
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="py-4 px-5">
                        <AccountStatusBadge status={accountStatus} />
                        <p className="text-[10px] text-slate-400 mt-1">
                          {tenant.lastLogin ? `Active ${getRelativeTime(tenant.lastLogin)}` : "No login"}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSubModalTenant(tenant)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#125fe2] hover:bg-blue-50 text-[11px] font-semibold text-slate-600 hover:text-[#125fe2] transition hidden sm:inline-flex items-center gap-1"
                            title="Manage Subscription"
                          >
                            <CreditCard size={12} />
                            <span>Plan</span>
                          </button>

                          <ActionMenu
                            tenant={tenant}
                            onViewDetails={() => setDrawerTenant(tenant)}
                            onEdit={() => openEditModal(tenant)}
                            onManageSub={() => setSubModalTenant(tenant)}
                            onViewUsers={() => {
                              setSelectedTenantForUsers(tenant);
                              setIsUsersModalOpen(true);
                            }}
                            onExtendSub={(days) => handleQuickExtend(tenant, days)}
                            onToggleSubPause={(action) => handleToggleSubPause(tenant, action)}
                            onExpireSub={() => handleForceExpireSub(tenant)}
                            onSuspend={() => handleToggleActivation(tenant.id, true, getName(tenant))}
                            onActivate={() => handleToggleActivation(tenant.id, false, getName(tenant))}
                            onApprove={() => handleStatusChange(tenant.id, "approve", getName(tenant))}
                            onBlock={() => handleStatusChange(tenant.id, "block", getName(tenant))}
                            onUnblock={() => handleStatusChange(tenant.id, "unblock", getName(tenant))}
                            onDelete={() => handleDeleteTenant(tenant.id, getName(tenant))}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        {filteredTenants.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
            <p>
              Showing <span className="font-semibold text-slate-700">{filteredTenants.length}</span> of{" "}
              <span className="font-semibold text-slate-700">{tenants.length}</span> tenants
            </p>
            <p>
              Synchronized <span className="font-medium text-slate-600">just now</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Manage Subscription Modal ── */}
      {subModalTenant && (
        <ManageSubscriptionModal
          tenant={subModalTenant}
          plans={plans}
          onClose={() => setSubModalTenant(null)}
          onSave={handleSubscriptionAction}
        />
      )}

      {/* ── Enhanced Drawer ── */}
      {drawerTenant && (
        <TenantDrawer
          tenant={drawerTenant}
          plans={plans}
          onClose={() => setDrawerTenant(null)}
          onEdit={() => {
            openEditModal(drawerTenant);
            setDrawerTenant(null);
          }}
          onManageSub={(t) => {
            setSubModalTenant(t);
          }}
          onExtendSub={(days) => handleQuickExtend(drawerTenant, days)}
          onToggleSubPause={(action) => handleToggleSubPause(drawerTenant, action)}
          onExpireSub={() => handleForceExpireSub(drawerTenant)}
          onSuspend={() => handleToggleActivation(drawerTenant.id, true, getName(drawerTenant))}
          onActivate={() => handleToggleActivation(drawerTenant.id, false, getName(drawerTenant))}
          onBlock={() => handleStatusChange(drawerTenant.id, "block", getName(drawerTenant))}
          onDelete={() => handleDeleteTenant(drawerTenant.id, getName(drawerTenant))}
        />
      )}

      {/* ── Onboard Tenant Modal ── */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden">
              <div
                className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2] to-blue-500 flex items-center justify-center shadow-md shadow-blue-200 text-white">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Onboard New Tenant</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Register a company on SudoReply</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalError("");
                  }}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
                >
                  <X size={15} />
                </button>
              </div>
              <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
                {modalError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{modalError}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Company Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="tenantName"
                    required
                    placeholder="e.g. Acme Corp"
                    value={newTenant.tenantName}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Admin Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="admin@company.com"
                    value={newTenant.email}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Admin Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="••••••••"
                      value={newTenant.password}
                      onChange={handleInputChange}
                      className="w-full text-xs px-3 py-2.5 pr-9 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                    />
                    <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Phone</label>
                    <input
                      type="text"
                      name="phone"
                      placeholder="+91 98765 43210"
                      value={newTenant.phone}
                      onChange={handleInputChange}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Address</label>
                    <input
                      type="text"
                      name="address"
                      placeholder="City, Country"
                      value={newTenant.address}
                      onChange={handleInputChange}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    disabled={modalLoading}
                    onClick={() => {
                      setIsModalOpen(false);
                      setModalError("");
                    }}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#125fe2] hover:bg-blue-700 text-white shadow-md shadow-blue-100 flex items-center gap-1.5 transition"
                  >
                    {modalLoading ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Creating…</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Onboard Tenant</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── Edit Tenant Modal ── */}
      {isEditModalOpen &&
        editingTenant &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden">
              <div
                className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                    <Edit size={15} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Edit Tenant Profile</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-52">{editingTenant.tenantName}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTenant(null);
                    setModalError("");
                  }}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
                >
                  <X size={15} />
                </button>
              </div>
              <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
                {modalError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{modalError}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Company Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={editingTenant.tenantName}
                    onChange={(e) => setEditingTenant({ ...editingTenant, tenantName: e.target.value })}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Admin Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@company.com"
                    value={editingTenant.email}
                    onChange={(e) => setEditingTenant({ ...editingTenant, email: e.target.value })}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={editingTenant.phone}
                      onChange={(e) => setEditingTenant({ ...editingTenant, phone: e.target.value })}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Address</label>
                    <input
                      type="text"
                      placeholder="City, Country"
                      value={editingTenant.address}
                      onChange={(e) => setEditingTenant({ ...editingTenant, address: e.target.value })}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#125fe2]"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    disabled={modalLoading}
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingTenant(null);
                      setModalError("");
                    }}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#125fe2] hover:bg-blue-700 text-white shadow-md shadow-blue-100 flex items-center gap-1.5 transition"
                  >
                    {modalLoading ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── View Team Users Modal ── */}
      {isUsersModalOpen &&
        selectedTenantForUsers &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden">
              <div
                className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, rgba(18,95,226,0.06) 0%, #fff 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                    <Users2 size={15} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Tenant Team Members</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedTenantForUsers.tenantName || selectedTenantForUsers.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsUsersModalOpen(false);
                    setSelectedTenantForUsers(null);
                  }}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="p-5 max-h-[440px] overflow-y-auto">
                {!selectedTenantForUsers.users || selectedTenantForUsers.users.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
                      <Users2 className="w-6 h-6" />
                    </div>
                    <p className="text-slate-700 font-semibold text-sm">No users yet</p>
                    <p className="text-slate-400 text-xs mt-1">No additional team members registered.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                      {selectedTenantForUsers.users.length} registered team members
                    </p>
                    {selectedTenantForUsers.users.map((usr) => (
                      <div
                        key={usr.id}
                        className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-blue-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                            {getInitials(usr.name)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{usr.name}</p>
                            <p className="text-[10px] text-slate-400">{usr.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${usr.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${usr.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
                            />
                            {usr.isActive ? "Active" : "Inactive"}
                          </span>
                          <button
                            onClick={() => handleToggleUserActivation(usr.id, usr.isActive, usr.name)}
                            className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition ${usr.isActive
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
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => {
                    setIsUsersModalOpen(false);
                    setSelectedTenantForUsers(null);
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

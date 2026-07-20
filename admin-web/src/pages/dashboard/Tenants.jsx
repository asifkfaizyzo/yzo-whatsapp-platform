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
} from "lucide-react";
import api from "../../lib/axios";
import axios from "axios";

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

function getTenantStatus(tenant) {
  if (tenant.status === "PENDING") return "Pending";
  if (tenant.status === "BLOCKED") return "Blocked";
  if (tenant.status === "APPROVED" && tenant.isActive) return "Active";
  if (tenant.status === "APPROVED" && !tenant.isActive) return "Suspended";
  return tenant.status || "Unknown";
}

function getInitials(name, fallback) {
  const str = name || fallback || "??";
  return str.split(" ").map((w) => w.charAt(0)).join("").substring(0, 2).toUpperCase();
}

// ─── Plan helpers — reads from tenant.plan.name (the real API field) ──────────

function getPlanLabel(tenant) {
  if (tenant?.planStatus === "enterprise_active") {
    return "Enterprise";
  }
  if (tenant?.planStatus === "enterprise_pending") {
    return "Enterprise (Pending)";
  }
  return tenant?.plan?.name || "Free";
}

function getPlanStatus(tenant) {
  return tenant?.planStatus || "inactive";
}

// ─── Config maps ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", glow: "shadow-emerald-100" },
  Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", glow: "shadow-amber-100" },
  Suspended: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", glow: "" },
  Blocked: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", glow: "shadow-rose-100" },
  Trial: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500", glow: "shadow-violet-100" },
  Expired: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", glow: "" },
};

const PLAN_CONFIG = {
  Free: {
    gradient: "from-slate-100 to-slate-200",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: Package,
    iconColor: "text-slate-500",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
  },
  Starter: {
    gradient: "from-blue-50 to-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Rocket,
    iconColor: "text-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  Basic: {
    gradient: "from-blue-50 to-indigo-100",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Rocket,
    iconColor: "text-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  Trial: {
    gradient: "from-violet-50 to-purple-100",
    text: "text-violet-700",
    border: "border-violet-200",
    icon: Sparkles,
    iconColor: "text-violet-500",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
  },
  Pro: {
    gradient: "from-indigo-50 to-violet-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: Star,
    iconColor: "text-indigo-500",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  Business: {
    gradient: "from-purple-50 to-fuchsia-100",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: Gem,
    iconColor: "text-purple-500",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
  },
  Enterprise: {
    gradient: "from-amber-50 to-yellow-100",
    text: "text-amber-800",
    border: "border-amber-200",
    icon: Crown,
    iconColor: "text-amber-600",
    badge: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-300",
  },
};

function resolvePlanConfig(planName) {
  if (!planName) return PLAN_CONFIG["Free"];
  const match = Object.keys(PLAN_CONFIG).find(
    (k) => k.toLowerCase() === planName.toLowerCase()
  );
  return PLAN_CONFIG[match] || PLAN_CONFIG["Free"];
}

// ─── Reusable components ──────────────────────────────────────────────────────

function StatCard({ icon: Icon, title, value, subtitle, iconColor, iconBg, growth }) {
  return (
    <div
      className="relative bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default group overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(18,95,226,0.04)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/50 pointer-events-none" />
      <div className="flex items-center justify-between relative">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={18} className={iconColor} />
        </div>
        {growth !== undefined && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            <TrendingUp size={10} />
            {growth >= 0 ? "+" : ""}{growth}%
          </span>
        )}
      </div>
      <div className="relative">
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-1">{title}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Pending"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${cfg.dot}`} />
      {status}
    </span>
  );
}

function PlanBadge({ planName }) {
  const label = planName || "Free";
  const cfg = resolvePlanConfig(label);
  const PlanIcon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.badge}`}>
      <PlanIcon size={10} className={cfg.iconColor} />
      {label}
    </span>
  );
}

// ─── 3-dot Action Menu ────────────────────────────────────────────────────────

function ActionMenu({ tenant, onViewDetails, onEdit, onViewUsers, onSuspend, onActivate, onApprove, onBlock, onUnblock, onDelete }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const dropdownRefVal = useRef(null);
  const status = getTenantStatus(tenant);

  const dropdownRef = useCallback((node) => {
    dropdownRefVal.current = node;
    if (node !== null && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const height = node.offsetHeight;
      const dropdownWidth = 208;
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceBelow < height && rect.top > height;
      setCoords({
        top: showAbove ? rect.top - height - 6 : rect.bottom + 6,
        left: Math.max(8, rect.right - dropdownWidth),
      });
    }
  }, [open]);

  useEffect(() => {
    const handleMousedown = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        (!dropdownRefVal.current || !dropdownRefVal.current.contains(e.target))
      ) {
        setOpen(false);
      }
    };
    const handleScroll = () => {
      setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", handleMousedown);
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleScroll);
    }
    return () => {
      document.removeEventListener("mousedown", handleMousedown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const MenuItem = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-colors duration-100 text-left font-medium ${danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"
        }`}
    >
      <Icon size={13} className={danger ? "text-rose-400" : "text-slate-400"} />
      {label}
    </button>
  );

  const Sep = () => <div className="h-px bg-slate-100 my-1" />;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${open ? "bg-[#125fe2] text-white shadow-md shadow-blue-200" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          }`}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-52 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-1.5"
          style={{
            top: coords.top,
            left: coords.left,
            boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)"
          }}
        >
          <div className="px-2 py-1.5 mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{tenant.tenantName || tenant.email}</p>
          </div>
          <Sep />
          <MenuItem icon={Eye} label="View Details" onClick={onViewDetails} />
          <MenuItem icon={Edit} label="Edit Tenant" onClick={onEdit} />
          <MenuItem icon={Users2} label="View Users" onClick={onViewUsers} />
          <Sep />
          {status === "Pending" && <MenuItem icon={UserCheck} label="Approve" onClick={onApprove} />}
          {status === "Active" && <MenuItem icon={Ban} label="Suspend" onClick={onSuspend} />}
          {status === "Suspended" && <MenuItem icon={ShieldCheck} label="Activate" onClick={onActivate} />}
          {status !== "Blocked" && <MenuItem icon={ShieldBan} label="Block" onClick={onBlock} />}
          {status === "Blocked" && <MenuItem icon={Unlock} label="Unblock" onClick={onUnblock} />}
          <Sep />
          <MenuItem icon={Trash2} label="Delete Tenant" onClick={onDelete} danger />
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Tenant Details Drawer ────────────────────────────────────────────────────

function TenantDrawer({ tenant, onClose, onEdit, onSuspend, onActivate, onBlock, onDelete }) {
  if (!tenant) return null;
  const status = getTenantStatus(tenant);
  const planName = getPlanLabel(tenant);
  const planCfg = resolvePlanConfig(planName);
  const PlanIcon = planCfg.icon;

  const Section = ({ title, children }) => (
    <div className="border-b border-slate-100 pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</h4>
      {children}
    </div>
  );

  const Field = ({ label, value, mono }) => (
    <div className="flex flex-col gap-0.5 mb-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 inline-block" : "text-slate-800"}`}>
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
          <span className="text-[9px] text-slate-400 mt-0.5 block">{value} / {max}</span>
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
        style={{ width: 520, maxWidth: "100vw", boxShadow: "-4px 0 60px rgba(0,0,0,0.14)" }}
      >
        {/* Header — glassmorphism */}
        <div
          className="px-6 py-5 border-b border-slate-100 flex-shrink-0 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(18,95,226,0.07) 0%, rgba(255,255,255,1) 70%)" }}
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#125fe2]/5 pointer-events-none" />
          <div className="flex items-start justify-between gap-4 relative">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#125fe2] to-[#3b82f6] flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-xl shadow-blue-200">
                {getInitials(tenant.tenantName, tenant.email)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{tenant.tenantName || tenant.email || "Unknown"}</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-52">{tenant.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={status} />
                  <PlanBadge planName={planName} />
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 mt-0.5">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          <Section title="Company Information">
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

          <Section title="Owner Information">
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Owner Name" value={tenant.ownerName || tenant.tenantName} />
              <Field label="Email" value={tenant.email} />
              <Field label="Phone" value={tenant.phone} />
              <Field label="Role" value="Tenant Admin" />
            </div>
          </Section>

          {/* Subscription — reads from tenant.plan (real API shape) */}
          <Section title="Subscription">
            {tenant.plan || tenant.planStatus === "enterprise_active" || tenant.planStatus === "enterprise_pending" ? (
              <div className={`rounded-2xl border p-4 mb-3 bg-gradient-to-br ${planCfg.gradient} ${planCfg.border}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
                    <PlanIcon size={15} className={planCfg.iconColor} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${planCfg.text}`}>{planName}</p>
                    <p className="text-[10px] text-slate-500">
                      {tenant.plan ? `₹${tenant.plan.monthlyPrice.toLocaleString()}/mo` : "Custom Sizing"} · {tenant.plan ? (tenant.billingType || "monthly") : "custom"}
                    </p>
                  </div>
                  <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-white/60 ${tenant.planStatus === "active" || tenant.planStatus === "enterprise_active"
                      ? "text-emerald-700 border-emerald-200"
                      : tenant.planStatus === "expired"
                        ? "text-rose-600 border-rose-200"
                        : "text-slate-600 border-slate-200"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${tenant.planStatus === "active" || tenant.planStatus === "enterprise_active" ? "bg-emerald-500" : tenant.planStatus === "expired" ? "bg-rose-500" : "bg-slate-400"
                      }`} />
                    {tenant.planStatus || "inactive"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Max Agents", val: tenant.plan ? (tenant.plan.maxAgents ?? "∞") : "∞" },
                    { label: "Max Campaigns", val: tenant.plan ? (tenant.plan.maxCampaigns ?? "∞") : "∞" },
                    { label: "Automations", val: tenant.plan ? (tenant.plan.maxAutomations ?? "∞") : "∞" },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white/60 rounded-xl px-3 py-2 text-center border border-white/80">
                      <p className="text-base font-bold text-slate-800">{val}</p>
                      <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3 mb-3">
                <Package size={18} className="text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-600">Free Plan</p>
                  <p className="text-xs text-slate-400 mt-0.5">No paid subscription active</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Billing Type" value={tenant.billingType || "—"} />
              <Field label="Plan Status" value={tenant.planStatus || "inactive"} />
              <Field label="Plan Activated" value={tenant.planActivatedAt ? new Date(tenant.planActivatedAt).toLocaleDateString() : "—"} />
            </div>
          </Section>

          <Section title="Usage Analytics">
            <div className="grid grid-cols-2 gap-2.5">
              <UsageCard icon={Users2} label="Users" value={tenant.users?.length || 0} max={tenant.plan?.maxAgents} bg="bg-blue-50 border-blue-100" iconCls="text-blue-400" />
              <UsageCard icon={MessageSquare} label="Contacts" value={tenant._count?.contacts ?? "—"} bg="bg-indigo-50 border-indigo-100" iconCls="text-indigo-400" />
              <UsageCard icon={Zap} label="Broadcasts" value={tenant._count?.broadcasts ?? "—"} max={tenant.plan?.maxBroadcasts} bg="bg-purple-50 border-purple-100" iconCls="text-purple-400" />
              <UsageCard icon={Layers} label="Templates" value={tenant._count?.templates ?? "—"} bg="bg-teal-50 border-teal-100" iconCls="text-teal-400" />
              <UsageCard icon={Activity} label="Flows" value={tenant._count?.flows ?? "—"} bg="bg-amber-50 border-amber-100" iconCls="text-amber-500" />
              <UsageCard icon={BarChart2} label="Messages Sent" value={tenant.messagesSent ?? "—"} bg="bg-emerald-50 border-emerald-100" iconCls="text-emerald-500" />
              <UsageCard icon={HardDrive} label="Storage" value={tenant.storageUsed ? `${tenant.storageUsed} MB` : "—"} bg="bg-orange-50 border-orange-100" iconCls="text-orange-400" />
              <UsageCard icon={Globe} label="API Calls" value={tenant.apiCalls ?? "—"} max={tenant.plan?.maxApiCalls} bg="bg-pink-50 border-pink-100" iconCls="text-pink-400" />
            </div>
          </Section>

          <Section title="WhatsApp">
            <div className="grid grid-cols-2 gap-x-5">
              <Field label="Business Name" value={tenant.whatsapp?.businessName || "—"} />
              <Field label="Phone Number" value={tenant.whatsapp?.phoneNumber || "—"} />
              <Field label="Quality Rating" value={tenant.whatsapp?.qualityRating || "—"} />
              <Field label="Verification Status" value={tenant.whatsapp?.verificationStatus || "—"} />
              <Field label="Embedded Signup" value={tenant.whatsapp?.embeddedSignup ? "Connected" : "Not Connected"} />
              <Field label="Cloud API Status" value={tenant.whatsapp?.cloudApiStatus || "—"} />
            </div>
          </Section>

          <Section title="Activity Timeline">
            <div className="space-y-3">
              <TLEvent icon={Building2} label="Tenant Created"
                time={tenant.createdAt ? new Date(tenant.createdAt).toLocaleString() : "—"}
                iconBg="bg-blue-50" iconColor="text-blue-500" />
              {tenant.status === "APPROVED" && (
                <TLEvent icon={CheckCircle} label="Account Approved"
                  time={tenant.approvedAt ? new Date(tenant.approvedAt).toLocaleString() : "After registration"}
                  iconBg="bg-emerald-50" iconColor="text-emerald-500" />
              )}
              {tenant.planActivatedAt && (
                <TLEvent icon={CreditCard} label={`${planName || "Plan"} Activated`}
                  time={new Date(tenant.planActivatedAt).toLocaleString()}
                  iconBg="bg-indigo-50" iconColor="text-indigo-500" />
              )}
              {tenant.lastLogin ? (
                <TLEvent icon={Clock} label="Last Login"
                  time={getRelativeTime(tenant.lastLogin)}
                  iconBg="bg-slate-50" iconColor="text-slate-400" />
              ) : (
                <TLEvent icon={UserX} label="Never Logged In"
                  time="No login recorded"
                  iconBg="bg-slate-50" iconColor="text-slate-300" />
              )}
            </div>
          </Section>

          <Section title="Danger Zone">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
              <p className="text-xs text-rose-500 font-medium mb-3">These actions may be irreversible.</p>
              <div className="flex flex-wrap gap-2">
                {status === "Active" && (
                  <button onClick={() => { onSuspend(); onClose(); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-semibold transition-colors shadow-sm">
                    <Ban size={13} /> Suspend
                  </button>
                )}
                {status === "Suspended" && (
                  <button onClick={() => { onActivate(); onClose(); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold transition-colors shadow-sm">
                    <ShieldCheck size={13} /> Activate
                  </button>
                )}
                {status !== "Blocked" && (
                  <button onClick={() => { onBlock(); onClose(); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors shadow-sm">
                    <ShieldBan size={13} /> Block
                  </button>
                )}
                <button onClick={() => { onDelete(); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold transition-colors shadow-sm">
                  <Trash2 size={13} /> Delete Tenant
                </button>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/60">
          <p className="text-[10px] text-slate-400">
            Created {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "—"}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs rounded-xl">Close</button>
            <button onClick={onEdit} className="btn-primary px-4 py-2 text-xs rounded-xl flex items-center gap-1.5">
              <Edit size={12} /> Edit Tenant
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Tenants() {
  const confirm = useConfirm();
  const toast = useToast();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Edit Tenant Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  // View Users Modal State
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [selectedTenantForUsers, setSelectedTenantForUsers] = useState(null);

  // Drawer
  const [drawerTenant, setDrawerTenant] = useState(null);

  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
    tenantName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  // ── API handlers (unchanged) ──────────────────────────────────────────────

  const fetchTenants = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/get-all-tenants");
      if (response.data?.success && response.data?.data?.tenants) {
        setTenants(response.data.data.tenants);
      } else {
        setError("Failed to fetch tenants.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);



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
          setTenants(tenants.map((t) =>
            t.id === selectedTenantForUsers.id ? { ...t, users: updatedUsers } : t
          ));
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

  // ── Filtering & Stats ───────────────────────────────────────────────────────

  const filteredTenants = tenants.filter((tenant) => {
    if (!tenant) return false;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (tenant.tenantName || "").toLowerCase().includes(q) ||
      (tenant.email || "").toLowerCase().includes(q) ||
      (tenant.phone || "").toLowerCase().includes(q) ||
      (tenant.subdomain || "").toLowerCase().includes(q);
    let matchesStatus = true;
    if (statusFilter === "Active") matchesStatus = tenant.status === "APPROVED" && tenant.isActive;
    if (statusFilter === "Pending") matchesStatus = tenant.status === "PENDING";
    if (statusFilter === "Suspended") matchesStatus = tenant.status === "APPROVED" && !tenant.isActive;
    if (statusFilter === "Blocked") matchesStatus = tenant.status === "BLOCKED";
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === "APPROVED" && t.isActive).length,
    pending: tenants.filter((t) => t.status === "PENDING").length,
    suspended: tenants.filter((t) => t.status === "APPROVED" && !t.isActive).length,
    blocked: tenants.filter((t) => t.status === "BLOCKED").length,
    totalUsers: tenants.reduce((acc, t) => acc + (t.users?.length || 0), 0),
  };

  const getName = (t) => t.tenantName || t.email || "Unknown Tenant";

  const openEditModal = (tenant) => {
    setEditingTenant({ id: tenant.id, tenantName: tenant.tenantName || "", email: tenant.email || "", phone: tenant.phone || "", address: tenant.address || "" });
    setModalError("");
    setIsEditModalOpen(true);
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12">


      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Building2} title="Total Tenants" value={stats.total} subtitle="All companies" iconBg="bg-blue-50" iconColor="text-[#125fe2]" growth={12} />
        <StatCard icon={CheckCircle} title="Active" value={stats.active} subtitle="Currently running" iconBg="bg-emerald-50" iconColor="text-emerald-600" growth={8} />
        <StatCard icon={Clock} title="Pending" value={stats.pending} subtitle="Awaiting approval" iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard icon={Ban} title="Suspended" value={stats.suspended} subtitle="Temporarily off" iconBg="bg-slate-100" iconColor="text-slate-500" />
        <StatCard icon={ShieldBan} title="Blocked" value={stats.blocked} subtitle="Access revoked" iconBg="bg-rose-50" iconColor="text-rose-600" />
        <StatCard icon={Users2} title="Total Users" value={stats.totalUsers} subtitle="Across all tenants" iconBg="bg-indigo-50" iconColor="text-indigo-600" growth={5} />
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#125fe2] to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
              <Building2 size={15} className="text-white" />
            </div>
            Tenant Management
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 ml-10">
            Manage companies, monitor subscriptions, users, and account health.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={fetchTenants} disabled={loading}
            className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-blue-200"
            style={{ background: "linear-gradient(135deg,#125fe2 0%,#2563eb 100%)" }}>
            <Plus size={16} />
            Onboard Tenant
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(18,95,226,0.05)" }}>

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52 max-w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search company, email, subdomain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 placeholder:text-slate-400 focus:outline-none focus:border-[#125fe2] focus:ring-2 focus:ring-blue-100 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1">
            {["All", "Active", "Pending", "Suspended", "Blocked"].map((tab) => (
              <button key={tab} onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${statusFilter === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400 font-semibold px-1">
              {filteredTenants.length} tenant{filteredTenants.length !== 1 ? "s" : ""}
            </span>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <RefreshCw className="w-6 h-6 text-[#125fe2] animate-spin" />
              </div>
              <p className="text-slate-600 font-semibold text-sm">Loading tenants...</p>
              <p className="text-slate-400 text-xs mt-1">Fetching from database</p>
            </div>
          ) : error ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <p className="text-slate-800 font-semibold text-sm">Failed to load</p>
              <p className="text-rose-500 text-xs mt-1">{error}</p>
              <button onClick={fetchTenants} className="mt-4 btn-secondary py-2 px-4 rounded-xl text-xs">Try Again</button>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-700 font-semibold text-sm">No tenants found</p>
              <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                  <th className="py-3 px-5">Company</th>
                  <th className="py-3 px-5">Owner</th>
                  <th className="py-3 px-5">Subscription</th>
                  <th className="py-3 px-5">Usage</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Created</th>
                  <th className="py-3 px-5">Last Login</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant, idx) => {
                  const status = getTenantStatus(tenant);
                  const planName = getPlanLabel(tenant);
                  const planCfg = resolvePlanConfig(planName);
                  const PlanIcon = planCfg.icon;
                  const userCount = tenant.users?.length || 0;

                  return (
                    <tr key={tenant.id}
                      className={`border-b border-slate-50 hover:bg-blue-50/25 transition-colors duration-100 ${idx % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}>

                      {/* Company */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2]/10 to-[#125fe2]/25 flex items-center justify-center text-[#125fe2] font-bold text-xs flex-shrink-0 border border-[#125fe2]/10">
                            {getInitials(tenant.tenantName, tenant.email)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm leading-tight">{tenant.tenantName || "Unnamed"}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {tenant.subdomain ? `${tenant.subdomain}.sudoreply.com` : `${tenant.id?.substring(0, 14)}…`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-4 px-5">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{tenant.tenantName || "—"}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Mail size={9} /> {tenant.email}</p>
                        {tenant.phone && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Phone size={9} /> {tenant.phone}</p>}
                      </td>

                      {/* Subscription — reads tenant.plan.name from API */}
                      <td className="py-4 px-5">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${planCfg.badge}`}>
                          <PlanIcon size={11} className={planCfg.iconColor} />
                          {planName}
                        </div>
                        {/* Plan status pill */}
                        {tenant.planStatus && (
                          <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${tenant.planStatus === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : tenant.planStatus === "expired"
                                ? "bg-rose-50 text-rose-600 border-rose-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                            {tenant.planStatus}
                          </div>
                        )}
                        {tenant.planActivatedAt && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <CalendarDays size={8} /> {new Date(tenant.planActivatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-5">
                        <div className="space-y-0.5 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <Users2 size={10} className="text-slate-400" />
                            <span className="text-slate-600 font-semibold">{userCount}/{tenant.plan?.maxAgents || 25} users</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare size={10} className="text-slate-400" />
                            <span className="text-slate-500">{tenant._count?.contacts ?? "—"} contacts</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Zap size={10} className="text-slate-400" />
                            <span className="text-slate-500">{tenant._count?.broadcasts ?? "—"} broadcasts</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Layers size={10} className="text-slate-400" />
                            <span className="text-slate-500">{tenant._count?.templates ?? "—"} templates</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5"><StatusBadge status={status} /></td>

                      {/* Created */}
                      <td className="py-4 px-5">
                        <p className="text-xs text-slate-600 font-medium">{new Date(tenant.createdAt).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(tenant.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </td>

                      {/* Last Login */}
                      <td className="py-4 px-5">
                        {tenant.lastLogin
                          ? <p className="text-xs text-slate-600">{getRelativeTime(tenant.lastLogin)}</p>
                          : <span className="text-[10px] italic text-slate-400">Never</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <ActionMenu
                          tenant={tenant}
                          onViewDetails={() => setDrawerTenant(tenant)}
                          onEdit={() => openEditModal(tenant)}
                          onViewUsers={() => { setSelectedTenantForUsers(tenant); setIsUsersModalOpen(true); }}
                          onSuspend={() => handleToggleActivation(tenant.id, true, getName(tenant))}
                          onActivate={() => handleToggleActivation(tenant.id, false, getName(tenant))}
                          onApprove={() => handleStatusChange(tenant.id, "approve", getName(tenant))}
                          onBlock={() => handleStatusChange(tenant.id, "block", getName(tenant))}
                          onUnblock={() => handleStatusChange(tenant.id, "unblock", getName(tenant))}
                          onDelete={() => handleDeleteTenant(tenant.id, getName(tenant))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredTenants.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{filteredTenants.length}</span> of <span className="font-semibold text-slate-600">{tenants.length}</span> tenants
            </p>
            <p className="text-xs text-slate-400">Last refreshed <span className="font-medium">just now</span></p>
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawerTenant && (
        <TenantDrawer
          tenant={drawerTenant}
          onClose={() => setDrawerTenant(null)}
          onEdit={() => { openEditModal(drawerTenant); setDrawerTenant(null); }}
          onSuspend={() => handleToggleActivation(drawerTenant.id, true, getName(drawerTenant))}
          onActivate={() => handleToggleActivation(drawerTenant.id, false, getName(drawerTenant))}
          onBlock={() => handleStatusChange(drawerTenant.id, "block", getName(drawerTenant))}
          onDelete={() => handleDeleteTenant(drawerTenant.id, getName(drawerTenant))}
        />
      )}

      {/* ── Onboard Tenant Modal ── */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg,rgba(18,95,226,0.06) 0%,#fff 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2] to-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
                  <Building2 size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Onboard New Tenant</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Register a company on SudoReply</p>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setModalError(""); }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
                  <AlertCircle size={14} /><span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="label text-xs">Company Name <span className="text-rose-400">*</span></label>
                <input type="text" name="tenantName" required placeholder="e.g. Acme Corp"
                  value={newTenant.tenantName} onChange={handleInputChange} className="input text-sm" />
              </div>
              <div>
                <label className="label text-xs">Admin Email <span className="text-rose-400">*</span></label>
                <input type="email" name="email" required placeholder="admin@company.com"
                  value={newTenant.email} onChange={handleInputChange} className="input text-sm" />
              </div>
              <div>
                <label className="label text-xs">Admin Password <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <input type="password" name="password" required placeholder="••••••••"
                    value={newTenant.password} onChange={handleInputChange} className="input pr-10 text-sm" />
                  <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Phone</label>
                  <input type="text" name="phone" placeholder="+91 98765 43210"
                    value={newTenant.phone} onChange={handleInputChange} className="input text-sm" />
                </div>
                <div>
                  <label className="label text-xs">Address</label>
                  <input type="text" name="address" placeholder="City, Country"
                    value={newTenant.address} onChange={handleInputChange} className="input text-sm" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" disabled={modalLoading}
                  onClick={() => { setIsModalOpen(false); setModalError(""); }}
                  className="btn-secondary px-4 py-2.5 text-xs font-semibold rounded-xl">Cancel</button>
                <button type="submit" disabled={modalLoading}
                  className="btn-primary px-5 py-2.5 text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5">
                  {modalLoading ? <><RefreshCw size={12} className="animate-spin" />Creating…</> : <><Plus size={12} />Onboard Tenant</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit Tenant Modal ── */}
      {isEditModalOpen && editingTenant && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg,rgba(18,95,226,0.06) 0%,#fff 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                  <Edit size={15} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edit Tenant</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-52">{editingTenant.tenantName}</p>
                </div>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setEditingTenant(null); setModalError(""); }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium flex items-center gap-2">
                  <AlertCircle size={14} /><span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="label text-xs">Company Name <span className="text-rose-400">*</span></label>
                <input type="text" required placeholder="e.g. Acme Corp"
                  value={editingTenant.tenantName}
                  onChange={(e) => setEditingTenant({ ...editingTenant, tenantName: e.target.value })}
                  className="input text-sm" />
              </div>
              <div>
                <label className="label text-xs">Admin Email <span className="text-rose-400">*</span></label>
                <input type="email" required placeholder="admin@company.com"
                  value={editingTenant.email}
                  onChange={(e) => setEditingTenant({ ...editingTenant, email: e.target.value })}
                  className="input text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Phone</label>
                  <input type="text" placeholder="+91 98765 43210"
                    value={editingTenant.phone}
                    onChange={(e) => setEditingTenant({ ...editingTenant, phone: e.target.value })}
                    className="input text-sm" />
                </div>
                <div>
                  <label className="label text-xs">Address</label>
                  <input type="text" placeholder="City, Country"
                    value={editingTenant.address}
                    onChange={(e) => setEditingTenant({ ...editingTenant, address: e.target.value })}
                    className="input text-sm" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" disabled={modalLoading}
                  onClick={() => { setIsEditModalOpen(false); setEditingTenant(null); setModalError(""); }}
                  className="btn-secondary px-4 py-2.5 text-xs font-semibold rounded-xl">Cancel</button>
                <button type="submit" disabled={modalLoading}
                  className="btn-primary px-5 py-2.5 text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5">
                  {modalLoading ? <><RefreshCw size={12} className="animate-spin" />Saving…</> : <><CheckCircle size={12} />Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── View Users Modal ── */}
      {isUsersModalOpen && selectedTenantForUsers && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg,rgba(18,95,226,0.06) 0%,#fff 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Users2 size={15} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Tenant Users</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedTenantForUsers.tenantName || selectedTenantForUsers.email}</p>
                </div>
              </div>
              <button onClick={() => { setIsUsersModalOpen(false); setSelectedTenantForUsers(null); }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition">
                <X size={15} />
              </button>
            </div>
            <div className="p-5 max-h-[440px] overflow-y-auto">
              {!selectedTenantForUsers.users || selectedTenantForUsers.users.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Users2 className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">No users yet</p>
                  <p className="text-slate-400 text-xs mt-1">No team members created.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                    {selectedTenantForUsers.users.length} registered users
                  </p>
                  {selectedTenantForUsers.users.map((usr) => (
                    <div key={usr.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                          {getInitials(usr.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{usr.name}</p>
                          <p className="text-[10px] text-slate-400">{usr.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${usr.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${usr.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {usr.isActive ? "Active" : "Inactive"}
                        </span>
                        <button
                          onClick={() => handleToggleUserActivation(usr.id, usr.isActive, usr.name)}
                          className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition ${usr.isActive
                              ? "bg-white hover:bg-amber-50 border-slate-200 text-amber-600 hover:border-amber-200"
                              : "bg-white hover:bg-blue-50 border-slate-200 text-[#125fe2] hover:border-blue-200"
                            }`}>
                          {usr.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button onClick={() => { setIsUsersModalOpen(false); setSelectedTenantForUsers(null); }}
                className="btn-secondary px-5 py-2 text-xs font-semibold rounded-xl">
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


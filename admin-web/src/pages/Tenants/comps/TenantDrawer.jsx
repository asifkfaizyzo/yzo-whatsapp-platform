// admin-web/src/pages/Tenants/comps/TenantDrawer.jsx (do not remove this comment)
import React from "react";
import {
  X,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Users2,
  CreditCard,
  ShieldAlert,
  Edit2,
  PlusCircle,
  ExternalLink,
} from "lucide-react";
import {
  PlanBadge,
  SubscriptionStatusBadge,
  AccountStatusBadge,
} from "./TenantBadges";
import {
  getTenantInitials,
  getSubscriptionStatus,
  getTenantAccountStatus,
  getPlanLabel,
  getDaysRemaining,
  formatDate,
} from "../tenant.constants";

export default function TenantDrawer({
  tenant,
  onClose,
  onEdit,
  onManageSub,
  onManualActivate,
  onManageTeam,
  onBlock,
  onUnblock,
}) {
  if (!tenant) return null;

  const accountStatus = getTenantAccountStatus(tenant);
  const subStatus = getSubscriptionStatus(tenant);
  const planName = getPlanLabel(tenant);
  const userCount = tenant._count?.users ?? tenant.users?.length ?? 0;
  const contactCount = tenant._count?.contacts ?? 0;
  const broadcastCount = tenant._count?.broadcasts ?? 0;
  const daysLeft = getDaysRemaining(
    tenant.planPeriodEnd || tenant.subscription?.currentPeriodEnd,
  );

  const isBlocked = tenant.status === "BLOCKED" || tenant.isBlocked;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#125fe2]/10 to-[#125fe2]/20 flex items-center justify-center text-[#125fe2] font-bold text-sm border border-[#125fe2]/10 shrink-0">
              {getTenantInitials(tenant)}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {tenant.tenantName || tenant.name || "Unnamed Tenant"}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID: {tenant.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Status Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Account Status
              </p>
              <div className="mt-1">
                <AccountStatusBadge status={accountStatus} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Plan Tier
              </p>
              <div className="mt-1">
                <PlanBadge planName={planName} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Subscription
              </p>
              <div className="mt-1">
                <SubscriptionStatusBadge status={subStatus} />
              </div>
            </div>
          </div>

          {/* Primary Actions Bar */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onEdit?.(tenant)}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Edit2 size={13} className="text-slate-400" />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={() => onManageSub?.(tenant)}
              className="flex-1 py-2 px-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-xs font-semibold text-[#125fe2] flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <CreditCard size={13} />
              <span>Manage Plan</span>
            </button>
            <button
              onClick={() => onManualActivate?.(tenant)}
              className="py-2 px-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <PlusCircle size={13} />
              <span>Manual Active</span>
            </button>
          </div>

          {/* Organization Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={14} className="text-[#125fe2]" />
              <span>Organization Info</span>
            </h3>
            <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 text-xs">
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Owner Name</span>
                <span className="font-semibold text-slate-800">
                  {tenant.ownerName ||
                    [tenant.firstName, tenant.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    "—"}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail size={12} /> Email
                </span>
                <span className="font-medium text-slate-800">
                  {tenant.email}
                </span>
              </div>
              {tenant.phone && (
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Phone size={12} /> Phone
                  </span>
                  <span className="font-medium text-slate-800">
                    {tenant.phone}
                  </span>
                </div>
              )}
              {tenant.subdomain && (
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Globe size={12} /> Subdomain
                  </span>
                  <a
                    href={`https://${tenant.subdomain}.sudoreply.com`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[#125fe2] hover:underline flex items-center gap-1"
                  >
                    <span>{tenant.subdomain}.sudoreply.com</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {tenant.country && (
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <MapPin size={12} /> Country / Region
                  </span>
                  <span className="font-medium text-slate-800">
                    {tenant.country}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Subscription & Expiry Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={14} className="text-[#125fe2]" />
              <span>Subscription & Billing</span>
            </h3>
            <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 text-xs">
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Current Period End</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(
                    tenant.planPeriodEnd ||
                      tenant.subscription?.currentPeriodEnd,
                  )}
                </span>
              </div>
              {daysLeft !== null && (
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-400">Time Remaining</span>
                  <span
                    className={`font-bold ${
                      daysLeft > 10
                        ? "text-emerald-600"
                        : daysLeft > 0
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {daysLeft > 0
                      ? `${daysLeft} days remaining`
                      : `Expired ${Math.abs(daysLeft)} days ago`}
                  </span>
                </div>
              )}
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Created At</span>
                <span className="font-medium text-slate-800">
                  {formatDate(tenant.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Usage Metrics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users2 size={14} className="text-[#125fe2]" />
              <span>Platform Usage</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">
                  Users
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {userCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  of {tenant.plan?.maxAgents || "∞"} max
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">
                  Contacts
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {contactCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">records</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">
                  Broadcasts
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {broadcastCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">campaigns</p>
              </div>
            </div>
          </div>

          {/* Block Reason Warning if blocked */}
          {isBlocked && tenant.blockReason && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>Account Blocked</span>
              </p>
              <p className="text-xs text-rose-700">{tenant.blockReason}</p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          {isBlocked ? (
            <button
              onClick={() => onUnblock?.(tenant)}
              className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Unblock Account</span>
            </button>
          ) : (
            <button
              onClick={() => onBlock?.(tenant)}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert size={13} />
              <span>Block Account</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

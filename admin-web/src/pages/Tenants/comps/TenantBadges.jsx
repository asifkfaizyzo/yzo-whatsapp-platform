// admin-web/src/pages/Tenants/comps/TenantBadges.jsx (do not remove this comment)
import React from "react";

export function PlanBadge({ planName, plan }) {
  const name = planName || (typeof plan === "string" ? plan : plan?.name) || "Free";
  const lower = name.toLowerCase();

  let style = "bg-slate-100 text-slate-700 border-slate-200";
  if (lower.includes("starter")) {
    style = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (lower.includes("pro")) {
    style = "bg-indigo-50 text-indigo-700 border-indigo-200";
  } else if (lower.includes("business")) {
    style = "bg-purple-50 text-purple-700 border-purple-200";
  } else if (lower.includes("enterprise")) {
    style = "bg-amber-50 text-amber-700 border-amber-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${style}`}
    >
      {name}
    </span>
  );
}

export function SubscriptionStatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
  let label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "Inactive";

  if (s === "active") {
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = "Active";
  } else if (s === "trialing") {
    badgeStyle = "bg-violet-50 text-violet-700 border-violet-200";
    label = "Trialing";
  } else if (s === "cancelling" || s === "canceled" || s === "expired") {
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
    label = s === "cancelling" ? "Cancelling" : "Expired";
  } else if (s === "paused") {
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
    label = "Paused";
  } else if (s === "pending") {
    badgeStyle = "bg-sky-50 text-sky-700 border-sky-200";
    label = "Pending";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeStyle}`}
    >
      {label}
    </span>
  );
}

export function AccountStatusBadge({ status }) {
  const s = (status || "").toUpperCase();
  let dotColor = "bg-slate-400";
  let textColor = "text-slate-600";
  let bg = "bg-slate-50 border-slate-200";

  if (s === "ACTIVE") {
    dotColor = "bg-emerald-500";
    textColor = "text-emerald-700";
    bg = "bg-emerald-50/60 border-emerald-200/80";
  } else if (s === "PENDING") {
    dotColor = "bg-amber-500";
    textColor = "text-amber-700";
    bg = "bg-amber-50/60 border-amber-200/80";
  } else if (s === "BLOCKED") {
    dotColor = "bg-rose-500";
    textColor = "text-rose-700";
    bg = "bg-rose-50/60 border-rose-200/80";
  } else if (s === "SUSPENDED" || s === "INACTIVE") {
    dotColor = "bg-slate-400";
    textColor = "text-slate-600";
    bg = "bg-slate-100 border-slate-200";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${bg} ${textColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{s}</span>
    </span>
  );
}

export function StatusBadge({ status, isActive }) {
  let accStatus = status;
  if (!accStatus) {
    accStatus = isActive === false ? "SUSPENDED" : isActive ? "ACTIVE" : "INACTIVE";
  }
  return <AccountStatusBadge status={accStatus} />;
}
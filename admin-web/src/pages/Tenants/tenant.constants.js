// admin-web/src/pages/Tenants/tenant.constants.js (do not remove this comment)
import {
  PlanBadge,
  SubscriptionStatusBadge,
  AccountStatusBadge,
  StatusBadge,
} from "./comps/TenantBadges";

export {
  PlanBadge,
  SubscriptionStatusBadge,
  AccountStatusBadge,
  StatusBadge,
};

export const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "PENDING", label: "Pending Approval" },
  { value: "CANCELLING", label: "Cancelling / Expired" },
  { value: "PAUSED", label: "Paused" },
  { value: "BLOCKED", label: "Blocked" },
];

export const PLAN_TIER_OPTIONS = [
  { value: "", label: "All Plan Tiers" },
  { value: "Free", label: "Free" },
  { value: "Starter", label: "Starter" },
  { value: "Pro", label: "Pro / Professional" },
  { value: "Business", label: "Business" },
  { value: "Enterprise", label: "Enterprise" },
];

export const SUB_STATUS_OPTIONS = [
  { value: "", label: "All Subscriptions" },
  { value: "active", label: "Active Only" },
  { value: "trialing", label: "Trialing Only" },
  { value: "cancelling", label: "Cancelling" },
  { value: "expired", label: "Expired" },
  { value: "paused", label: "Paused" },
];

export function getInitials(name, email) {
  const source = (name || email || "").trim();
  if (!source) return "TN";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.substring(0, 2).toUpperCase();
}

export function getTenantInitials(tenant) {
  if (!tenant) return "TN";
  return getInitials(tenant.tenantName || tenant.name, tenant.email);
}

export function getName(tenant) {
  return (
    tenant?.tenantName ||
    [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ") ||
    tenant?.email ||
    "Tenant"
  );
}

export function getDaysRemaining(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getRelativeTime(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Never";
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function getSubscriptionStatus(tenant) {
  if (!tenant) return "inactive";
  if (tenant.subscriptionStatus) return tenant.subscriptionStatus.toLowerCase();
  if (tenant.subscription?.status) return tenant.subscription.status.toLowerCase();
  if (tenant.status === "TRIALING") return "trialing";
  if (tenant.status === "ACTIVE" || tenant.isActive) return "active";
  return "inactive";
}

export function getTenantAccountStatus(tenant) {
  if (!tenant) return "INACTIVE";
  if (tenant.status === "BLOCKED" || tenant.isBlocked) return "BLOCKED";
  if (tenant.status === "PENDING") return "PENDING";
  if (tenant.status === "SUSPENDED" || tenant.isActive === false) return "SUSPENDED";
  if (tenant.status === "ACTIVE" || tenant.isActive) return "ACTIVE";
  return tenant.status || "INACTIVE";
}

export function getPlanLabel(tenant) {
  if (!tenant) return "Free";
  if (tenant.plan?.name) return tenant.plan.name;
  if (tenant.subscription?.plan?.name) return tenant.subscription.plan.name;
  if (tenant.planTier) return tenant.planTier;
  return "Free";
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
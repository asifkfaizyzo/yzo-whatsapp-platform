// tenant-web/src/components/billing/SubscriptionExpiryBanner.jsx
import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert, RefreshCw, Zap } from "lucide-react";

export default function SubscriptionExpiryBanner({ planPeriodEnd, subscriptionStatus, autopayEnabled, planId, billingType }) {
  if (!planPeriodEnd || (subscriptionStatus !== "active" && subscriptionStatus !== "trialing" && subscriptionStatus !== "cancel_at_period_end")) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const planEnd = new Date(planPeriodEnd);
  planEnd.setHours(0, 0, 0, 0);

  const diffTime = planEnd.getTime() - today.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Only show the warning banner when there are 10 days or fewer remaining in the billing cycle
  if (daysRemaining > 10 || daysRemaining < 0) {
    return null;
  }

  const formattedDate = planEnd.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timeLabel = daysRemaining === 0 ? "today" : daysRemaining === 1 ? "tomorrow" : `in ${daysRemaining} days`;

  // ── CASE A: AUTOPAY ENABLED (Upcoming Auto-Renewal Notice) ──
  if (autopayEnabled) {
    let config = {
      bgColor: "bg-blue-50/90 border-blue-200/90",
      textColor: "text-blue-950",
      subTextColor: "text-blue-800",
      icon: <Zap className="text-blue-600 shrink-0 mt-0.5" size={20} />,
      title: "Upcoming Auto-Debit Renewal ⚡",
      message: `Your subscription will automatically renew ${timeLabel} on ${formattedDate}. Payment will be auto-debited via your saved payment method.`,
    };

    if (daysRemaining <= 3) {
      config.bgColor = "bg-indigo-50 border-indigo-200";
      config.textColor = "text-indigo-950";
      config.subTextColor = "text-indigo-900";
      config.icon = <RefreshCw className="text-indigo-600 shrink-0 mt-0.5" size={20} />;
      config.message = `Auto-debit scheduled ${timeLabel} on ${formattedDate}. Please ensure your payment method has sufficient balance.`;
    }

    return (
      <div className={`mb-6 rounded-2xl border p-4 flex items-center gap-3 transition-all duration-300 shadow-2xs ${config.bgColor}`}>
        <div className="p-2 rounded-xl bg-white shadow-2xs border border-blue-100 shrink-0">
          {config.icon}
        </div>
        <div>
          <p className={`text-sm font-bold ${config.textColor}`}>{config.title}</p>
          <p className={`text-xs font-medium mt-0.5 leading-relaxed ${config.subTextColor}`}>{config.message}</p>
        </div>
      </div>
    );
  }

  // ── CASE B: AUTOPAY DISABLED / MANUAL EXPIRY WARNING ──
  const isTrial = subscriptionStatus === "trialing";
  const renewCheckoutUrl = isTrial
    ? "/select-plan?upgrade=true"
    : (planId ? `/checkout?planId=${planId}&billing=${billingType || 'monthly'}` : "/select-plan?upgrade=true");

  let config = {
    bgColor: "bg-amber-50 border-amber-200",
    textColor: "text-amber-950",
    subTextColor: "text-amber-800",
    buttonColor: "bg-amber-600 hover:bg-amber-700 text-white",
    icon: <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />,
    title: isTrial ? "Free Trial Ending Soon ⏰" : "Subscription Expiration Warning ⚠️",
    message: isTrial
      ? `Your 14-day free trial will end ${timeLabel} on ${formattedDate}. Upgrade to a paid plan to keep your WhatsApp bots and features active.`
      : `Your plan access will expire ${timeLabel} on ${formattedDate}. Autopay is off. Renew to prevent messaging downtime.`,
    buttonLabel: isTrial ? "Upgrade to Paid Plan" : "Renew Current Plan",
    targetUrl: renewCheckoutUrl,
  };

  if (daysRemaining <= 3) {
    config.bgColor = "bg-rose-50 border-rose-200";
    config.textColor = "text-rose-950";
    config.subTextColor = "text-rose-800";
    config.buttonColor = "bg-rose-600 hover:bg-rose-700 text-white";
    config.icon = <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={20} />;
    config.title = isTrial ? "Critical: Free Trial Ends Very Soon" : "Critical: Plan Expires Very Soon";
    config.message = isTrial
      ? `Your free trial expires ${timeLabel} on ${formattedDate}. Upgrade now to prevent messaging downtime.`
      : `Your platform access expires ${timeLabel} on ${formattedDate}. Renew now to keep your WhatsApp bots and broadcast queues active.`;
    config.buttonLabel = isTrial ? "Upgrade Immediately" : "Renew Immediately";
    config.targetUrl = renewCheckoutUrl;
  }

  return (
    <div className={`mb-6 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 shadow-2xs ${config.bgColor}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-white shadow-2xs border border-amber-100 shrink-0">
          {config.icon}
        </div>
        <div>
          <p className={`text-sm font-bold ${config.textColor}`}>{config.title}</p>
          <p className={`text-xs font-medium mt-0.5 leading-relaxed ${config.subTextColor}`}>{config.message}</p>
        </div>
      </div>
      <Link
        to={config.targetUrl}
        className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm leading-none ${config.buttonColor}`}
      >
        <RefreshCw size={13} className="shrink-0" />
        <span>{config.buttonLabel}</span>
      </Link>
    </div>
  );
}

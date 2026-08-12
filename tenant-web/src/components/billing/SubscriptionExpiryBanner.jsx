import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, Info, ShieldAlert } from "lucide-react";

export default function SubscriptionExpiryBanner({ planPeriodEnd, subscriptionStatus }) {
  if (subscriptionStatus !== "active" || !planPeriodEnd) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const planEnd = new Date(planPeriodEnd);
  planEnd.setHours(0, 0, 0, 0);

  const diffTime = planEnd.getTime() - today.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Determine banner styling and configuration based on days remaining
  let config = null;

  if (daysRemaining > 7 && daysRemaining <= 15) {
    config = {
      bgColor: "bg-blue-50 border-blue-100",
      textColor: "text-blue-900",
      subTextColor: "text-blue-700",
      buttonColor: "bg-blue-600 hover:bg-blue-700 text-white",
      icon: <Info className="text-blue-500 shrink-0" size={20} />,
      message: `Your plan expires in ${daysRemaining} days on ${planEnd.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}. Renew now to avoid interruption.`
    };
  } else if (daysRemaining > 3 && daysRemaining <= 7) {
    config = {
      bgColor: "bg-amber-50 border-amber-100",
      textColor: "text-amber-900",
      subTextColor: "text-amber-700",
      buttonColor: "bg-amber-600 hover:bg-amber-700 text-white",
      icon: <AlertCircle className="text-amber-500 shrink-0" size={20} />,
      message: `Your plan expires in ${daysRemaining} days on ${planEnd.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}. Renew now to avoid interruption.`
    };
  } else if (daysRemaining > 1 && daysRemaining <= 3) {
    config = {
      bgColor: "bg-orange-50 border-orange-100",
      textColor: "text-orange-950",
      subTextColor: "text-orange-700",
      buttonColor: "bg-orange-600 hover:bg-orange-700 text-white",
      icon: <AlertTriangle className="text-orange-500 shrink-0" size={20} />,
      message: `Only ${daysRemaining} days left! Your plan expires on ${planEnd.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}. Renew now to prevent account lock.`
    };
  } else if (daysRemaining >= 0 && daysRemaining <= 1) {
    const timeLabel = daysRemaining === 0 ? "today" : "tomorrow";
    config = {
      bgColor: "bg-red-50 border-red-100",
      textColor: "text-red-950",
      subTextColor: "text-red-700",
      buttonColor: "bg-red-600 hover:bg-red-700 text-white",
      icon: <ShieldAlert className="text-red-500 shrink-0" size={20} />,
      message: `Critical: Your plan expires ${timeLabel} on ${planEnd.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}. Renew immediately to avoid lockout.`
    };
  }

  if (!config) {
    return null;
  }

  return (
    <div className={`mb-6 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${config.bgColor}`}>
      <div className="flex items-center gap-3">
        {config.icon}
        <div>
          <p className={`text-sm font-bold ${config.textColor}`}>Subscription Expiry Warning</p>
          <p className={`text-xs font-medium mt-0.5 ${config.subTextColor}`}>{config.message}</p>
        </div>
      </div>
      <Link
        to="/plans?upgrade=true"
        className={`shrink-0 text-center px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${config.buttonColor}`}
      >
        Renew Now
      </Link>
    </div>
  );
}

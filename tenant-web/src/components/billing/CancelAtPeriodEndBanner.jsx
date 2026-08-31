import React from "react";
import { AlertCircle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

export default function CancelAtPeriodEndBanner({ periodEndDate }) {
  const formatDate = (dateVal) => {
    if (!dateVal || dateVal === "N/A") return "—";
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  return (
    <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
          <AlertCircle size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">Subscription scheduled to end</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Autopay is disabled. Full platform access remains active until <strong>{formatDate(periodEndDate)}</strong>.
          </p>
        </div>
      </div>
      <Link
        to="/select-plan?upgrade=true"
        className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#125EF2] hover:bg-[#0d4fd6] text-xs font-bold text-white transition shadow-sm leading-none"
      >
        <CreditCard size={14} className="shrink-0" />
        <span>Subscribe to Plan</span>
      </Link>
    </div>
  );
}